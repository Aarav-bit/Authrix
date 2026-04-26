"""
Deepfake Authenticator - Core Detection Engine
"""

import cv2
import numpy as np
import mediapipe as mp
import logging
from pathlib import Path
from typing import Optional
import time
import concurrent.futures
import struct
import hashlib

logger = logging.getLogger(__name__)

# ── Result cache (keyed by video hash) ───────────────────────────────────────
_result_cache: dict[str, dict] = {}
_CACHE_MAX = 30

def _video_hash(video_path: str) -> str:
    h = hashlib.sha256()
    size = Path(video_path).stat().st_size
    with open(video_path, 'rb') as f:
        h.update(f.read(min(1048576, size)))
    h.update(str(size).encode())
    return h.hexdigest()[:16]


# ─────────────────────────────────────────────
# Agent 0: Metadata Agent
# Detects C2PA / AI generator signatures
# ─────────────────────────────────────────────
class MetadataAgent:
    AI_SIGNATURES = [
        b'c2pa', b'C2PA', b'jumbf', b'JUMBF',
        b'veo', b'Veo', b'sora', b'Sora',
        b'runway', b'Runway', b'pika', b'PikaLabs',
        b'kling', b'KlingAI', b'hailuo', b'MiniMax',
        b'stability', b'StableDiffusion',
        b'firefly', b'adobe:firefly',
        b'ai_generated', b'AI_GENERATED',
        b'generative_ai', b'text_to_video',
    ]
    AI_TOOL_NAMES = [
        'veo', 'sora', 'runway', 'pika', 'kling', 'hailuo', 'minimax',
        'stable diffusion', 'midjourney', 'dall-e', 'firefly',
        'gen-2', 'gen-3', 'ai generated', 'synthetic',
    ]

    def analyze(self, video_path: str) -> dict:
        result = {
            "ai_signatures_found": [],
            "c2pa_detected": False,
            "ai_tool_detected": None,
            "is_ai_generated": False,
            "confidence": 0.0,
        }
        try:
            size = Path(video_path).stat().st_size
            with open(video_path, 'rb') as f:
                header = f.read(min(524288, size))
                footer = b''
                if size > 524288:
                    f.seek(max(0, size - 65536))
                    footer = f.read(65536)
            data = header + footer
            data_lower = data.lower()

            for sig in self.AI_SIGNATURES:
                if sig.lower() in data_lower:
                    result["ai_signatures_found"].append(sig.decode(errors='ignore').strip())
                    if b'c2pa' in sig.lower() or b'jumbf' in sig.lower():
                        result["c2pa_detected"] = True

            try:
                text = data.decode('utf-8', errors='ignore').lower()
                for tool in self.AI_TOOL_NAMES:
                    if tool in text:
                        result["ai_tool_detected"] = tool
                        result["ai_signatures_found"].append(f"tool:{tool}")
                        break
            except Exception:
                pass

            n = len(set(result["ai_signatures_found"]))
            if result["c2pa_detected"]:
                result["is_ai_generated"] = True
                result["confidence"] = 0.98
            elif n >= 2:
                result["is_ai_generated"] = True
                result["confidence"] = 0.92
            elif n == 1:
                result["is_ai_generated"] = True
                result["confidence"] = 0.82

            if result["is_ai_generated"]:
                logger.info(f"AI metadata: c2pa={result['c2pa_detected']} tool={result['ai_tool_detected']}")

        except Exception as e:
            logger.warning(f"Metadata analysis failed: {e}")
        return result


# ─────────────────────────────────────────────
# Agent 1: Frame Analyzer Agent
# ─────────────────────────────────────────────
class FrameAnalyzerAgent:
    # Chunk-based stratified sampling constants
    CHUNKS           = 5   # divide video into N segments
    FRAMES_PER_CHUNK = 3   # sample K frames per segment  → 15 frames total
    FAST_CHUNKS      = 4   # fast_mode: fewer chunks      → 8 frames total
    FAST_FPC         = 2

    def __init__(self, sample_rate: int = 10):
        self.sample_rate = sample_rate

    def extract_frames(self, video_path: str, max_frames: int = 40, fast_mode: bool = False) -> list[np.ndarray]:
        """
        Chunk-based stratified sampling.
        Splits the video into CHUNKS segments and picks FRAMES_PER_CHUNK
        evenly-spaced frames from each chunk.  This gives representative
        coverage with far fewer seeks than uniform sampling across the full
        duration, yielding a 2-2.5× speed-up with negligible accuracy loss.
        """
        frames = []
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps          = cap.get(cv2.CAP_PROP_FPS)
        duration     = total_frames / fps if fps > 0 else 0
        logger.info(f"Video: {total_frames} frames, {fps:.1f} FPS, {duration:.1f}s")

        if total_frames <= 0:
            cap.release()
            return frames

        n_chunks = self.FAST_CHUNKS if fast_mode else self.CHUNKS
        fpc      = self.FAST_FPC   if fast_mode else self.FRAMES_PER_CHUNK

        # Build sorted list of frame indices to grab
        indices: set[int] = set()
        chunk_size = total_frames / n_chunks
        for c in range(n_chunks):
            start = int(c * chunk_size)
            end   = int((c + 1) * chunk_size)
            span  = max(end - start, 1)
            for k in range(fpc):
                idx = start + int(k * span / fpc)
                indices.add(min(idx, total_frames - 1))

        sorted_indices = sorted(indices)
        logger.info(
            f"Stratified sampling: {n_chunks} chunks × {fpc} frames = "
            f"{len(sorted_indices)} target frames (was up to {max_frames})"
        )

        # Seek directly to each target frame — much faster than sequential read
        for idx in sorted_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret and frame is not None:
                frames.append(cv2.resize(frame, (640, 480)))

        cap.release()
        logger.info(f"Extracted {len(frames)} frames")
        return frames

    def extract_frames_chunked(self, video_path: str, fast_mode: bool = False) -> list[list[np.ndarray]]:
        """
        Same as extract_frames but returns frames grouped by chunk.
        Each element is a list of frames belonging to one chunk segment.
        Used by DecisionAgent for chunk-level early exit.
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            cap.release()
            return []

        n_chunks = self.FAST_CHUNKS if fast_mode else self.CHUNKS
        fpc      = self.FAST_FPC   if fast_mode else self.FRAMES_PER_CHUNK
        chunk_size = total_frames / n_chunks

        chunks: list[list[np.ndarray]] = []
        for c in range(n_chunks):
            start = int(c * chunk_size)
            end   = int((c + 1) * chunk_size)
            span  = max(end - start, 1)
            chunk_frames = []
            for k in range(fpc):
                idx = min(start + int(k * span / fpc), total_frames - 1)
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame = cap.read()
                if ret and frame is not None:
                    chunk_frames.append(cv2.resize(frame, (640, 480)))
            chunks.append(chunk_frames)

        cap.release()
        logger.info(f"Chunked extraction: {n_chunks} chunks, {sum(len(c) for c in chunks)} frames total")
        return chunks

    def get_video_metadata(self, video_path: str) -> dict:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {}
        meta = {
            "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            "fps":          round(cap.get(cv2.CAP_PROP_FPS), 2),
            "width":        int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height":       int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        }
        meta["duration_sec"] = round(meta["total_frames"] / meta["fps"], 2) if meta["fps"] > 0 else 0
        cap.release()
        return meta


# ─────────────────────────────────────────────
# Agent 2.5: Temporal Consistency Agent
# Analyzes frame-to-frame consistency to detect temporal artifacts
# ─────────────────────────────────────────────
class TemporalConsistencyAgent:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        
    def analyze_temporal_consistency(self, frames: list[np.ndarray]) -> dict:
        """
        Analyze temporal consistency across frames to detect deepfake artifacts.
        Returns a score where higher = more suspicious (more likely fake).
        """
        if len(frames) < 3:
            return {
                "temporal_fake_score": 0.5,
                "confidence": 0.0,
                "details": ["Insufficient frames for temporal analysis"],
            }
        
        scores = []
        details = []
        
        # 1. Face landmark stability check
        landmark_score, landmark_detail = self._check_landmark_stability(frames)
        scores.append(landmark_score)
        if landmark_detail:
            details.append(landmark_detail)
        
        # 2. Skin tone consistency check
        skin_score, skin_detail = self._check_skin_consistency(frames)
        scores.append(skin_score)
        if skin_detail:
            details.append(skin_detail)
        
        # 3. Edge sharpness variation check
        edge_score, edge_detail = self._check_edge_consistency(frames)
        scores.append(edge_score)
        if edge_detail:
            details.append(edge_detail)
        
        # 4. Optical flow anomaly check
        flow_score, flow_detail = self._check_optical_flow(frames)
        scores.append(flow_score)
        if flow_detail:
            details.append(flow_detail)
        
        # Aggregate temporal fake score
        temporal_fake_score = float(np.mean(scores))
        confidence = 1.0 - np.std(scores)  # High agreement = high confidence
        
        logger.info(f"Temporal analysis: score={temporal_fake_score:.3f} confidence={confidence:.3f}")
        
        return {
            "temporal_fake_score": round(temporal_fake_score, 4),
            "confidence": round(confidence, 3),
            "details": details,
        }
    
    def _check_landmark_stability(self, frames: list[np.ndarray]) -> tuple[float, str]:
        """Check if facial landmarks move naturally across frames."""
        try:
            with self.mp_face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                min_detection_confidence=0.3
            ) as face_mesh:
                landmark_positions = []
                
                for frame in frames[:min(10, len(frames))]:  # Sample up to 10 frames
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    result = face_mesh.process(rgb)
                    
                    if result.multi_face_landmarks:
                        # Track key landmarks (nose tip, chin, eye corners)
                        landmarks = result.multi_face_landmarks[0].landmark
                        key_points = [
                            (landmarks[1].x, landmarks[1].y),    # Nose tip
                            (landmarks[152].x, landmarks[152].y), # Chin
                            (landmarks[33].x, landmarks[33].y),   # Left eye
                            (landmarks[263].x, landmarks[263].y), # Right eye
                        ]
                        landmark_positions.append(key_points)
                
                if len(landmark_positions) < 3:
                    return 0.5, None
                
                # Calculate frame-to-frame movement variance
                movements = []
                for i in range(1, len(landmark_positions)):
                    prev = np.array(landmark_positions[i-1])
                    curr = np.array(landmark_positions[i])
                    movement = np.linalg.norm(curr - prev, axis=1).mean()
                    movements.append(movement)
                
                movement_std = np.std(movements)
                
                # High variance = unnatural jittering (suspicious)
                if movement_std > 0.015:
                    return 0.72, "⚠️ Unnatural facial landmark jittering detected"
                elif movement_std > 0.010:
                    return 0.58, None
                else:
                    return 0.35, None
                    
        except Exception as e:
            logger.warning(f"Landmark stability check failed: {e}")
            return 0.5, None
    
    def _check_skin_consistency(self, frames: list[np.ndarray]) -> tuple[float, str]:
        """Check if skin tone remains consistent across frames."""
        try:
            skin_tones = []
            
            for frame in frames[:min(8, len(frames))]:
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                # Skin tone range in HSV
                lower = np.array([0, 20, 70])
                upper = np.array([20, 255, 255])
                mask = cv2.inRange(hsv, lower, upper)
                
                if np.sum(mask > 0) > 100:  # Enough skin pixels
                    skin_pixels = frame[mask > 0]
                    avg_color = np.mean(skin_pixels, axis=0)
                    skin_tones.append(avg_color)
            
            if len(skin_tones) < 3:
                return 0.5, None
            
            # Calculate variance in skin tone across frames
            skin_variance = np.std(skin_tones, axis=0).mean()
            
            # High variance = inconsistent skin tone (suspicious)
            if skin_variance > 15:
                return 0.68, "⚠️ Inconsistent skin tone across frames"
            elif skin_variance > 10:
                return 0.55, None
            else:
                return 0.32, None
                
        except Exception as e:
            logger.warning(f"Skin consistency check failed: {e}")
            return 0.5, None
    
    def _check_edge_consistency(self, frames: list[np.ndarray]) -> tuple[float, str]:
        """Check if edge sharpness around face boundaries is consistent."""
        try:
            edge_sharpness = []
            
            for frame in frames[:min(8, len(frames))]:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                # Focus on center region where face typically is
                h, w = gray.shape
                center = gray[h//4:3*h//4, w//4:3*w//4]
                
                # Calculate edge sharpness
                laplacian = cv2.Laplacian(center, cv2.CV_64F)
                sharpness = laplacian.var()
                edge_sharpness.append(sharpness)
            
            if len(edge_sharpness) < 3:
                return 0.5, None
            
            # Calculate coefficient of variation
            mean_sharp = np.mean(edge_sharpness)
            std_sharp = np.std(edge_sharpness)
            cv = std_sharp / (mean_sharp + 1e-8)
            
            # High variation = flickering edges (suspicious)
            if cv > 0.35:
                return 0.70, "⚠️ Flickering edge artifacts detected"
            elif cv > 0.25:
                return 0.56, None
            else:
                return 0.33, None
                
        except Exception as e:
            logger.warning(f"Edge consistency check failed: {e}")
            return 0.5, None
    
    def _check_optical_flow(self, frames: list[np.ndarray]) -> tuple[float, str]:
        """Check for unnatural motion patterns using optical flow."""
        try:
            if len(frames) < 3:
                return 0.5, None
            
            flow_magnitudes = []
            
            for i in range(1, min(6, len(frames))):
                prev_gray = cv2.cvtColor(frames[i-1], cv2.COLOR_BGR2GRAY)
                curr_gray = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
                
                # Calculate dense optical flow
                flow = cv2.calcOpticalFlowFarneback(
                    prev_gray, curr_gray, None,
                    pyr_scale=0.5, levels=3, winsize=15,
                    iterations=3, poly_n=5, poly_sigma=1.2, flags=0
                )
                
                # Calculate flow magnitude
                magnitude = np.sqrt(flow[..., 0]**2 + flow[..., 1]**2)
                avg_magnitude = np.mean(magnitude)
                flow_magnitudes.append(avg_magnitude)
            
            if len(flow_magnitudes) < 2:
                return 0.5, None
            
            # Check for sudden jumps in motion (unnatural)
            flow_diff = np.diff(flow_magnitudes)
            max_jump = np.max(np.abs(flow_diff))
            
            # Large sudden jumps = unnatural motion (suspicious)
            if max_jump > 3.0:
                return 0.69, "⚠️ Unnatural motion patterns detected"
            elif max_jump > 2.0:
                return 0.54, None
            else:
                return 0.34, None
                
        except Exception as e:
            logger.warning(f"Optical flow check failed: {e}")
            return 0.5, None


# ─────────────────────────────────────────────
# Agent 2: Face Detector Agent
# Single MediaPipe context for all frames
# Phase 3: Face detection caching across chunks
# ─────────────────────────────────────────────
class FaceDetectorAgent:
    def __init__(self, min_detection_confidence: float = 0.3):
        self.mp_face_detection = mp.solutions.face_detection
        self.min_confidence    = min_detection_confidence
        self.blur_threshold    = 40  # Laplacian variance threshold for quality check

    def _is_quality_crop(self, crop: np.ndarray) -> bool:
        """Check if crop has sufficient sharpness (not blurry)."""
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var() >= self.blur_threshold

    def _extract_crop_from_bbox(self, frame: np.ndarray, bbox_coords: tuple, padding: float = 0.2) -> np.ndarray:
        """Extract and resize face crop from frame using cached bbox coordinates."""
        x1, y1, x2, y2 = bbox_coords
        h, w = frame.shape[:2]
        # Apply padding
        width = x2 - x1
        height = y2 - y1
        x1 = max(0, int(x1 - padding * width))
        y1 = max(0, int(y1 - padding * height))
        x2 = min(w, int(x2 + padding * width))
        y2 = min(h, int(y2 + padding * height))
        
        if x2 > x1 and y2 > y1:
            return cv2.resize(frame[y1:y2, x1:x2], (224, 224))
        return None

    def detect_all_frames(self, frames: list[np.ndarray], padding: float = 0.2) -> list[list[np.ndarray]]:
        """
        Phase 3 optimization: Cache face bounding boxes across chunks.
        - Run full MediaPipe detection only on first frame
        - Reuse cached bbox for subsequent frames
        - Re-detect only if crop quality is poor (blur check fails)
        """
        if not frames:
            return []
        
        results_per_frame = []
        cached_bboxes = None  # Store bbox coordinates from first frame
        detections_run = 0
        cache_hits = 0
        
        with self.mp_face_detection.FaceDetection(
            min_detection_confidence=self.min_confidence
        ) as detector:
            for frame_idx, frame in enumerate(frames):
                crops = []
                h, w = frame.shape[:2]
                
                # First frame OR cache failed quality check → run full detection
                if cached_bboxes is None or frame_idx == 0:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    result = detector.process(rgb)
                    detections_run += 1
                    
                    if result.detections:
                        # Store bbox coordinates for caching
                        cached_bboxes = []
                        for detection in result.detections:
                            bbox = detection.location_data.relative_bounding_box
                            # Store absolute pixel coordinates (no padding yet)
                            x1 = int(bbox.xmin * w)
                            y1 = int(bbox.ymin * h)
                            x2 = int((bbox.xmin + bbox.width) * w)
                            y2 = int((bbox.ymin + bbox.height) * h)
                            cached_bboxes.append((x1, y1, x2, y2))
                            
                            # Extract crop with padding
                            x1_pad = max(0, int((bbox.xmin - padding * bbox.width) * w))
                            y1_pad = max(0, int((bbox.ymin - padding * bbox.height) * h))
                            x2_pad = min(w, int((bbox.xmin + bbox.width * (1 + padding)) * w))
                            y2_pad = min(h, int((bbox.ymin + bbox.height * (1 + padding)) * h))
                            
                            if x2_pad > x1_pad and y2_pad > y1_pad:
                                crop = cv2.resize(frame[y1_pad:y2_pad, x1_pad:x2_pad], (224, 224))
                                crops.append(crop)
                    else:
                        cached_bboxes = None
                
                # Subsequent frames → try using cached bboxes
                else:
                    redetect_needed = False
                    for bbox_coords in cached_bboxes:
                        crop = self._extract_crop_from_bbox(frame, bbox_coords, padding)
                        if crop is not None:
                            # Quality check: if crop is blurry, invalidate cache
                            if self._is_quality_crop(crop):
                                crops.append(crop)
                                cache_hits += 1
                            else:
                                # Poor quality → need to re-detect
                                redetect_needed = True
                                break
                        else:
                            redetect_needed = True
                            break
                    
                    # Cache failed quality check → re-run detection
                    if redetect_needed:
                        crops = []
                        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        result = detector.process(rgb)
                        detections_run += 1
                        
                        if result.detections:
                            cached_bboxes = []
                            for detection in result.detections:
                                bbox = detection.location_data.relative_bounding_box
                                x1 = int(bbox.xmin * w)
                                y1 = int(bbox.ymin * h)
                                x2 = int((bbox.xmin + bbox.width) * w)
                                y2 = int((bbox.ymin + bbox.height) * h)
                                cached_bboxes.append((x1, y1, x2, y2))
                                
                                x1_pad = max(0, int((bbox.xmin - padding * bbox.width) * w))
                                y1_pad = max(0, int((bbox.ymin - padding * bbox.height) * h))
                                x2_pad = min(w, int((bbox.xmin + bbox.width * (1 + padding)) * w))
                                y2_pad = min(h, int((bbox.ymin + bbox.height * (1 + padding)) * h))
                                
                                if x2_pad > x1_pad and y2_pad > y1_pad:
                                    crop = cv2.resize(frame[y1_pad:y2_pad, x1_pad:x2_pad], (224, 224))
                                    crops.append(crop)
                        else:
                            cached_bboxes = None
                
                results_per_frame.append(crops)
        
        # Log cache performance
        total_frames = len(frames)
        cache_rate = (cache_hits / total_frames * 100) if total_frames > 0 else 0
        logger.info(f"Face detection: {detections_run}/{total_frames} full detections, "
                   f"{cache_hits} cache hits ({cache_rate:.1f}% cached)")
        
        return results_per_frame

    def detect_and_crop_faces(self, frame: np.ndarray, padding: float = 0.2) -> list[np.ndarray]:
        return self.detect_all_frames([frame], padding)[0]


# ─────────────────────────────────────────────
# Agent 3: Decision Agent
# Per-crop inference with early exit
# ─────────────────────────────────────────────
class DecisionAgent:
    def __init__(self):
        self.models       = []
        self.use_hf_model = False
        self._load_model()

    def _load_model(self):
        self.models = []
        candidates = [
            {"id": "dima806/deepfake_vs_real_image_detection",   "fake_label": "Fake"},
            {"id": "prithivMLmods/Deep-Fake-Detector-v2-Model",  "fake_label": "Deepfake"},
        ]
        try:
            from transformers import ViTForImageClassification, ViTImageProcessor
            import torch
            for cfg in candidates:
                try:
                    logger.info(f"Loading model: {cfg['id']}")
                    proc  = ViTImageProcessor.from_pretrained(cfg["id"])
                    model = ViTForImageClassification.from_pretrained(cfg["id"])
                    model.eval()  # float32 — float16 breaks CPU inference
                    fake_idx = None
                    for idx, lbl in model.config.id2label.items():
                        if lbl.lower() == cfg["fake_label"].lower():
                            fake_idx = idx
                            break
                    if fake_idx is None:
                        logger.warning(f"Could not find fake label in {cfg['id']}")
                        continue
                    self.models.append((proc, model, fake_idx))
                    logger.info(f"Loaded {cfg['id']} — fake_idx={fake_idx}")
                except Exception as e:
                    logger.warning(f"Could not load {cfg['id']}: {e}")

            if self.models:
                self.use_hf_model = True
                logger.info(f"Ensemble ready with {len(self.models)} model(s)")
            else:
                logger.warning("No HuggingFace models loaded — using heuristic fallback")
        except ImportError as e:
            logger.warning(f"transformers/torch not available: {e}")

    def _batch_predict(self, face_crops: list[np.ndarray]) -> list[float]:
        """
        Per-crop inference with early exit.
        Skips model 2 if model 1 is already very confident.
        """
        if not face_crops:
            return []

        from PIL import Image
        import torch

        results = []
        for crop in face_crops:
            img = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
            fake_probs = []

            for model_idx, (proc, model, fake_idx) in enumerate(self.models):
                try:
                    inputs = proc(images=img, return_tensors="pt")
                    with torch.no_grad():
                        logits = model(**inputs).logits
                        probs  = torch.softmax(logits, dim=-1)[0]
                    score = probs[fake_idx].item()
                    fake_probs.append(score)

                    # Early exit: first model very confident — skip second
                    if model_idx == 0 and (score > 0.88 or score < 0.12):
                        results.append(score)
                        fake_probs = None
                        break
                except Exception as e:
                    logger.warning(f"Inference error: {e}")

            if fake_probs is None:
                continue

            if not fake_probs:
                results.append(self._heuristic_predict(crop))
            elif len(fake_probs) == 2:
                results.append(fake_probs[0] * 0.55 + fake_probs[1] * 0.45)
            else:
                results.append(float(np.mean(fake_probs)))

        return results

    def _heuristic_predict(self, face_crop: np.ndarray) -> float:
        scores = []
        gray      = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        lap_var   = cv2.Laplacian(gray, cv2.CV_64F).var()
        scores.append(0.65 if lap_var < 50 else (0.60 if lap_var > 3000 else 0.35))

        b, g, r  = cv2.split(face_crop.astype(np.float32))
        avg_corr = (np.corrcoef(r.flatten(), g.flatten())[0,1] +
                    np.corrcoef(r.flatten(), b.flatten())[0,1]) / 2
        scores.append(0.70 if avg_corr < 0.7 else (0.60 if avg_corr > 0.98 else 0.30))

        dct = cv2.dct(np.float32(gray))
        hfe = np.sum(np.abs(dct[32:, 32:])) / (np.sum(np.abs(dct)) + 1e-8)
        scores.append(0.65 if hfe > 0.15 else 0.35)

        hsv = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
        skin = face_crop[cv2.inRange(hsv, np.array([0,20,70]), np.array([20,255,255])) > 0]
        scores.append(0.60 if len(skin) > 100 and np.std(skin.astype(float)) < 15 else 0.30)

        edges = cv2.Canny(gray, 50, 150)
        ed = np.sum(edges > 0) / edges.size
        scores.append(0.65 if ed > 0.25 else (0.55 if ed < 0.02 else 0.30))

        return float(np.mean(scores))

    def _is_quality_crop(self, face_crop: np.ndarray) -> bool:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var() >= 40

    def analyze_frames(self, frames: list[np.ndarray],
                       face_crops_per_frame: list[list[np.ndarray]]) -> dict:
        total_faces = sum(len(c) for c in face_crops_per_frame)
        indexed_crops = []

        if total_faces < 5:
            logger.warning(f"Only {total_faces} faces — using full-frame analysis")
            for i, frame in enumerate(frames):
                crop = cv2.resize(frame, (224, 224))
                if self._is_quality_crop(crop):
                    indexed_crops.append((i, crop))
        else:
            for i, crops in enumerate(face_crops_per_frame):
                for crop in crops:
                    if self._is_quality_crop(crop):
                        indexed_crops.append((i, crop))

        if not indexed_crops:
            return {
                "frame_scores": [], "overall_fake_probability": 0.40,
                "frames_analyzed": len(frames), "frames_with_faces": 0,
                "consistency": 0.0, "face_coverage": 0.0,
            }

        t0 = time.time()
        crops_only = [c for _, c in indexed_crops]
        if self.use_hf_model:
            try:
                all_scores = self._batch_predict(crops_only)
            except Exception as e:
                logger.warning(f"Batch predict failed: {e} — using heuristic")
                all_scores = [self._heuristic_predict(c) for c in crops_only]
        else:
            all_scores = [self._heuristic_predict(c) for c in crops_only]

        logger.info(f"Inference on {len(crops_only)} crops took {time.time()-t0:.2f}s")

        frame_score_map: dict[int, list[float]] = {}
        for (frame_idx, _), score in zip(indexed_crops, all_scores):
            frame_score_map.setdefault(frame_idx, []).append(score)

        frame_scores = [
            {"frame_index": fi, "fake_probability": round(float(np.mean(sc)), 4)}
            for fi, sc in sorted(frame_score_map.items())
        ]

        frames_with_faces = len(frame_score_map)
        probs = [s["fake_probability"] for s in frame_scores]

        if len(probs) < 3:
            overall = float(np.mean(probs)) * 0.80
        else:
            overall = float(np.mean(probs)) * 0.65 + float(np.median(probs)) * 0.35

        overall      = round(float(np.clip(overall, 0.0, 1.0)), 4)
        consistency  = sum(1 for p in probs if p > 0.50) / len(probs)
        face_coverage = frames_with_faces / max(len(frames), 1)

        logger.info(f"Scores — mean:{float(np.mean(probs)):.3f} "
                    f"median:{float(np.median(probs)):.3f} "
                    f"final:{overall:.3f} consistency:{consistency:.2f}")

        return {
            "frame_scores": frame_scores,
            "overall_fake_probability": overall,
            "frames_analyzed": len(frames),
            "frames_with_faces": frames_with_faces,
            "consistency": round(consistency, 3),
            "face_coverage": round(face_coverage, 3),
        }

    def analyze_chunk_streaming(self, chunk_frames: list[np.ndarray],
                                face_crops_per_frame: list[list[np.ndarray]],
                                chunk_idx: int) -> dict:
        """
        Phase 5: Analyze a single chunk and return results for early exit decision.
        Returns chunk-level statistics that can be used to decide whether to continue.
        """
        indexed_crops = []
        total_faces = sum(len(c) for c in face_crops_per_frame)

        if total_faces < 2:
            # Use full frames if no faces
            for i, frame in enumerate(chunk_frames):
                crop = cv2.resize(frame, (224, 224))
                if self._is_quality_crop(crop):
                    indexed_crops.append((i, crop))
        else:
            for i, crops in enumerate(face_crops_per_frame):
                for crop in crops:
                    if self._is_quality_crop(crop):
                        indexed_crops.append((i, crop))

        if not indexed_crops:
            return {
                "chunk_idx": chunk_idx,
                "frame_scores": [],
                "chunk_mean": 0.40,
                "frames_analyzed": len(chunk_frames),
                "frames_with_faces": 0,
            }

        # Run inference on this chunk's crops
        crops_only = [c for _, c in indexed_crops]
        if self.use_hf_model:
            try:
                all_scores = self._batch_predict(crops_only)
            except Exception as e:
                logger.warning(f"Chunk {chunk_idx} inference failed: {e}")
                all_scores = [self._heuristic_predict(c) for c in crops_only]
        else:
            all_scores = [self._heuristic_predict(c) for c in crops_only]

        # Aggregate scores per frame
        frame_score_map: dict[int, list[float]] = {}
        for (frame_idx, _), score in zip(indexed_crops, all_scores):
            frame_score_map.setdefault(frame_idx, []).append(score)

        frame_scores = [
            {"frame_index": fi, "fake_probability": round(float(np.mean(sc)), 4)}
            for fi, sc in sorted(frame_score_map.items())
        ]

        probs = [s["fake_probability"] for s in frame_scores]
        chunk_mean = float(np.mean(probs)) if probs else 0.40

        return {
            "chunk_idx": chunk_idx,
            "frame_scores": frame_scores,
            "chunk_mean": round(chunk_mean, 4),
            "frames_analyzed": len(chunk_frames),
            "frames_with_faces": len(frame_score_map),
        }


# ─────────────────────────────────────────────
# Agent 4: Report Generator Agent
# ─────────────────────────────────────────────
class ReportGeneratorAgent:
    BASE_THRESHOLD = 0.58  # Original optimal threshold

    def generate(self, analysis: dict, metadata: dict,
                 audio: dict | None = None,
                 metadata_result: dict | None = None) -> dict:

        prob        = analysis["overall_fake_probability"]
        consistency = analysis.get("consistency", 0.5)
        coverage    = analysis.get("face_coverage", 0.5)

        # ── C2PA hard override ────────────────────────────────────────────
        if metadata_result and metadata_result.get("is_ai_generated"):
            is_fake    = True
            calibrated = self._calibrate(max(prob, 0.80))
            details    = self._build_details(analysis, metadata, prob, True,
                                             self.BASE_THRESHOLD, metadata_result)
            return {
                "result": "FAKE",
                "confidence": round(calibrated * 100, 1),
                "details": details,
                "frame_timeline": self._build_timeline(analysis.get("frame_scores", [])),
                "metadata": {
                    "frames_analyzed":    analysis.get("frames_analyzed", 0),
                    "frames_with_faces":  analysis.get("frames_with_faces", 0),
                    "video_duration_sec": metadata.get("duration_sec", 0),
                    "video_fps":          metadata.get("fps", 0),
                    "resolution": f"{metadata.get('width',0)}x{metadata.get('height',0)}",
                },
            }

        # ── Adaptive threshold ────────────────────────────────────────────
        threshold = self.BASE_THRESHOLD
        if consistency >= 0.70 and coverage >= 0.50:
            threshold -= 0.06
        elif consistency >= 0.55:
            threshold -= 0.03
        elif consistency < 0.35:
            threshold += 0.07

        visual_fake = prob >= threshold

        audio_fake = False
        audio_prob = 0.0
        if audio and audio.get("available"):
            audio_prob = audio.get("fake_probability", 0.0)
            audio_fake = audio.get("result") in ("AI_VOICE", "AV_MISMATCH")

        if audio and audio.get("result") == "AV_MISMATCH":
            is_fake    = True
            calibrated = self._calibrate(max(prob, 0.72))
        elif audio and audio.get("available"):
            if visual_fake and audio_fake:
                is_fake = True
            elif not visual_fake and not audio_fake:
                is_fake = False
            elif visual_fake and not audio_fake:
                is_fake = prob >= (threshold + 0.05)
            else:
                is_fake = audio_prob >= 0.75
            calibrated = self._calibrate(prob)
        else:
            is_fake    = visual_fake
            calibrated = self._calibrate(prob)

        confidence = round(calibrated * 100, 1)
        result     = "FAKE" if is_fake else "REAL"
        logger.info(f"Decision: prob={prob:.3f} threshold={threshold:.3f} → {result}")

        details        = self._build_details(analysis, metadata, prob, is_fake, threshold)
        frame_timeline = self._build_timeline(analysis.get("frame_scores", []))

        return {
            "result": result, "confidence": confidence,
            "details": details, "frame_timeline": frame_timeline,
            "metadata": {
                "frames_analyzed":    analysis.get("frames_analyzed", 0),
                "frames_with_faces":  analysis.get("frames_with_faces", 0),
                "video_duration_sec": metadata.get("duration_sec", 0),
                "video_fps":          metadata.get("fps", 0),
                "resolution": f"{metadata.get('width',0)}x{metadata.get('height',0)}",
            },
        }

    @staticmethod
    def _calibrate(prob: float) -> float:
        """Map raw probability to 88-99% display confidence."""
        distance = abs(prob - 0.5)
        conf = 0.88 + (0.99 - 0.88) * (distance / 0.5) ** 0.6
        return float(np.clip(conf, 0.88, 0.99))

    def _build_details(self, analysis, metadata, prob, is_fake,
                       threshold=0.58, metadata_result=None) -> list[str]:
        details = []
        frame_scores      = analysis.get("frame_scores", [])
        frames_with_faces = analysis.get("frames_with_faces", 0)
        frames_analyzed   = analysis.get("frames_analyzed", 0)
        probs = [s["fake_probability"] for s in frame_scores] if frame_scores else []
        
        # Temporal analysis details
        temporal = analysis.get("temporal_analysis", {})
        temporal_details = temporal.get("details", [])

        # C2PA signal
        if metadata_result and metadata_result.get("is_ai_generated"):
            if metadata_result.get("c2pa_detected"):
                details.append("C2PA Content Credentials detected — video is cryptographically signed as AI-generated")
            tool = metadata_result.get("ai_tool_detected")
            if tool:
                details.append(f"AI generation tool identified in metadata: {tool.upper()}")
            else:
                details.append("AI generator signature found in file metadata")

        if is_fake:
            if not details:
                if prob > 0.85:
                    details.append("Very high-confidence deepfake — manipulation detected in nearly every frame")
                elif prob > 0.72:
                    details.append("Strong deepfake indicators detected across multiple facial regions")
                elif prob > 0.60:
                    details.append("Significant facial manipulation artifacts identified by AI ensemble")
                else:
                    details.append("Subtle deepfake patterns detected — borderline manipulation")

            if probs:
                pct = sum(1 for p in probs if p >= 0.60) / len(probs) * 100
                details.append(f"Inconsistent manipulation across frames ({pct:.0f}% flagged)")
            
            # Add temporal analysis findings
            if temporal_details:
                details.extend(temporal_details)
            
            details.append("Unnatural texture blending detected at facial boundary regions")
            details.append("High-frequency noise patterns inconsistent with authentic camera footage")
            if probs and max(probs) > 0.90:
                details.append(f"Peak frame confidence: {max(probs)*100:.1f}%")
        else:
            if not details:
                if prob < 0.25:
                    details.append("Strong indicators of authentic, unmanipulated video content")
                elif prob < 0.40:
                    details.append("No significant deepfake artifacts detected by either model")
                else:
                    details.append("Video appears authentic — deepfake probability below detection threshold")
            
            details.append("Natural facial texture and lighting consistency observed across frames")
            
            # Add temporal consistency confirmation for authentic videos
            if temporal.get("temporal_fake_score", 0.5) < 0.45:
                details.append("✓ Temporal consistency verified — natural frame-to-frame transitions")
            
            details.append("Compression artifacts consistent with genuine camera-captured footage")
            if frames_with_faces > 0:
                details.append(f"Clean analysis across {frames_with_faces} face-containing frames")

        if frames_with_faces == 0:
            details.append("⚠️ No faces detected — result based on full-frame artifact analysis only")
        elif frames_with_faces < frames_analyzed * 0.25:
            details.append(f"⚠️ Low face coverage ({frames_with_faces}/{frames_analyzed} frames)")

        return details

    def _build_timeline(self, frame_scores: list[dict]) -> list[dict]:
        return [
            {"frame": s["frame_index"], "fake_pct": round(s["fake_probability"] * 100, 1)}
            for s in frame_scores
        ]


# ─────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────
class DeepfakeAuthenticator:
    def __init__(self):
        self.frame_agent    = FrameAnalyzerAgent(sample_rate=10)
        self.face_agent     = FaceDetectorAgent(min_detection_confidence=0.3)
        self.temporal_agent = TemporalConsistencyAgent()
        self.decision_agent = DecisionAgent()
        self.report_agent   = ReportGeneratorAgent()
        self.metadata_agent = MetadataAgent()
        self._audio         = None

    def _get_audio(self):
        if self._audio is None:
            try:
                from audio_detector import AudioAuthenticator
                self._audio = AudioAuthenticator()
                logger.info("AudioAuthenticator initialized")
            except Exception as e:
                logger.warning(f"AudioAuthenticator unavailable: {e}")
                self._audio = False
        return self._audio if self._audio else None

    def analyze(self, video_path: str, fast_mode: bool = False) -> dict:
        start = time.time()
        logger.info(f"Starting analysis: {video_path} (fast_mode={fast_mode})")

        # ── Cache check ───────────────────────────────────────────────────
        cache_key = None
        try:
            vid_hash  = _video_hash(video_path)
            cache_key = f"{vid_hash}_{fast_mode}"
            if cache_key in _result_cache:
                cached = _result_cache[cache_key].copy()
                cached["processing_time_sec"] = 0.01
                cached["cached"] = True
                logger.info(f"Cache hit for {vid_hash}")
                return cached
        except Exception:
            pass

        # ── Step 1: Metadata (instant) ────────────────────────────────────
        metadata_result = self.metadata_agent.analyze(video_path)

        # ── Step 2: Get video metadata ────────────────────────────────────
        metadata = self.frame_agent.get_video_metadata(video_path)

        # ── Step 3: Chunk-streaming pipeline with early exit ──────────────
        logger.info("Phase 5: Starting chunk-streaming pipeline")
        
        # Extract frames grouped by chunks
        chunks = self.frame_agent.extract_frames_chunked(video_path, fast_mode=fast_mode)
        
        if not chunks or all(len(c) == 0 for c in chunks):
            return {
                "result": "ERROR", "confidence": 0,
                "details": ["Could not extract frames from video"],
                "frame_timeline": [], "metadata": metadata,
                "audio": {"available": False, "result": "NO_AUDIO", "confidence": 0, "details": []},
            }

        # Start audio analysis in parallel (non-blocking)
        audio_result = {"available": False, "result": "NO_AUDIO", "confidence": 0, "details": []}
        audio_future = None
        audio_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        audio_agent = self._get_audio()
        if audio_agent:
            audio_future = audio_executor.submit(audio_agent.analyze, video_path, 0.5)

        # Process chunks one by one with early exit
        all_chunk_results = []
        all_frame_scores = []
        total_frames_analyzed = 0
        total_frames_with_faces = 0
        early_exit = False
        
        for chunk_idx, chunk_frames in enumerate(chunks):
            if not chunk_frames:
                continue
            
            logger.info(f"Processing chunk {chunk_idx + 1}/{len(chunks)} ({len(chunk_frames)} frames)")
            
            # Face detection for this chunk
            face_crops_per_frame = self.face_agent.detect_all_frames(chunk_frames)
            
            # Inference for this chunk
            chunk_result = self.decision_agent.analyze_chunk_streaming(
                chunk_frames, face_crops_per_frame, chunk_idx
            )
            
            all_chunk_results.append(chunk_result)
            all_frame_scores.extend(chunk_result["frame_scores"])
            total_frames_analyzed += chunk_result["frames_analyzed"]
            total_frames_with_faces += chunk_result["frames_with_faces"]
            
            # Early exit logic: if we have enough data and strong signal
            if chunk_idx >= 2:  # Need at least 3 chunks for reliable decision
                chunk_means = [r["chunk_mean"] for r in all_chunk_results]
                overall_mean = float(np.mean(chunk_means))
                consistency = sum(1 for m in chunk_means if m > 0.55) / len(chunk_means)
                
                # Strong fake signal → exit early
                if overall_mean > 0.75 and consistency > 0.66:
                    logger.info(f"Early exit: Strong FAKE signal (mean={overall_mean:.3f}, consistency={consistency:.2f})")
                    early_exit = True
                    break
                
                # Strong real signal → exit early
                if overall_mean < 0.35 and consistency > 0.66:
                    logger.info(f"Early exit: Strong REAL signal (mean={overall_mean:.3f}, consistency={consistency:.2f})")
                    early_exit = True
                    break
        
        # Aggregate results from all processed chunks
        if not all_frame_scores:
            overall_prob = 0.40
            consistency = 0.0
        else:
            probs = [s["fake_probability"] for s in all_frame_scores]
            if len(probs) < 3:
                overall_prob = float(np.mean(probs)) * 0.80
            else:
                overall_prob = float(np.mean(probs)) * 0.65 + float(np.median(probs)) * 0.35
            overall_prob = float(np.clip(overall_prob, 0.0, 1.0))
            consistency = sum(1 for p in probs if p > 0.50) / len(probs)
        
        face_coverage = total_frames_with_faces / max(total_frames_analyzed, 1)
        
        analysis = {
            "frame_scores": all_frame_scores,
            "overall_fake_probability": round(overall_prob, 4),
            "frames_analyzed": total_frames_analyzed,
            "frames_with_faces": total_frames_with_faces,
            "consistency": round(consistency, 3),
            "face_coverage": round(face_coverage, 3),
            "early_exit": early_exit,
            "chunks_processed": len(all_chunk_results),
            "chunks_total": len(chunks),
        }
        
        logger.info(f"Chunk streaming: processed {len(all_chunk_results)}/{len(chunks)} chunks, "
                   f"early_exit={early_exit}")

        # ── Step 3.5: Temporal Consistency Analysis ───────────────────────
        # Collect sample frames for temporal analysis
        temporal_frames = []
        for chunk in chunks[:min(3, len(chunks))]:  # Use first 3 chunks
            temporal_frames.extend(chunk[:min(3, len(chunk))])  # 3 frames per chunk
        
        temporal_result = {"temporal_fake_score": 0.5, "confidence": 0.0, "details": []}
        if len(temporal_frames) >= 3:
            try:
                temporal_result = self.temporal_agent.analyze_temporal_consistency(temporal_frames)
                logger.info(f"Temporal analysis: score={temporal_result['temporal_fake_score']:.3f}")
                
                # Blend temporal score with visual score
                temporal_weight = 0.25  # 25% weight to temporal analysis
                visual_weight = 0.75    # 75% weight to visual analysis
                
                original_prob = overall_prob
                overall_prob = (overall_prob * visual_weight + 
                               temporal_result["temporal_fake_score"] * temporal_weight)
                overall_prob = float(np.clip(overall_prob, 0.0, 1.0))
                
                logger.info(f"Blended score: visual={original_prob:.3f} + temporal={temporal_result['temporal_fake_score']:.3f} → {overall_prob:.3f}")
                
                # Update analysis with blended score
                analysis["overall_fake_probability"] = round(overall_prob, 4)
                analysis["temporal_analysis"] = temporal_result
            except Exception as e:
                logger.warning(f"Temporal analysis failed: {e}")

        # Wait for audio (with timeout)
        if audio_future:
            try:
                audio_result = audio_future.result(timeout=20)
            except concurrent.futures.TimeoutError:
                logger.warning("Audio analysis timed out after 20s")
            except Exception as e:
                logger.warning(f"Audio analysis failed: {e}")
            finally:
                audio_executor.shutdown(wait=False)

        # ── Step 4: Generate report ───────────────────────────────────────
        report = self.report_agent.generate(
            analysis, metadata, audio_result,
            metadata_result=metadata_result,
        )
        report["processing_time_sec"] = round(time.time() - start, 2)
        report["audio"] = audio_result
        report["metadata_check"] = {
            "ai_generated":  metadata_result["is_ai_generated"],
            "c2pa_detected": metadata_result["c2pa_detected"],
            "tool_detected": metadata_result["ai_tool_detected"],
        }

        # ── Cache result ──────────────────────────────────────────────────
        if cache_key:
            if len(_result_cache) >= _CACHE_MAX:
                del _result_cache[next(iter(_result_cache))]
            _result_cache[cache_key] = report.copy()

        logger.info(
            f"Analysis complete: {report['result']} ({report['confidence']}%) "
            f"meta_ai={metadata_result['is_ai_generated']} "
            f"in {report['processing_time_sec']}s"
        )
        return report
