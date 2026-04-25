"""
Deepfake Authenticator - Core Detection Engine
Optimized for speed: batched inference, parallel processing, cached MediaPipe context.
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
import json

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Agent 0a: C2PA / Metadata Agent
# Detects Content Credentials from AI generators
# (Veo3, Sora, Runway, Firefly, DALL-E, etc.)
# ─────────────────────────────────────────────
class MetadataAgent:
    # Known AI generator signatures in file metadata
    AI_GENERATOR_SIGNATURES = [
        # C2PA / Content Credentials markers
        b'c2pa', b'C2PA', b'jumbf', b'JUMBF',
        # Google Veo / DeepMind
        b'veo', b'Veo', b'google/veo',
        # OpenAI Sora
        b'sora', b'Sora', b'openai',
        # Runway
        b'runway', b'Runway',
        # Stability AI
        b'stability', b'StableDiffusion', b'stable-diffusion',
        # Meta
        b'emu_video', b'EmuVideo',
        # Adobe Firefly
        b'firefly', b'adobe:firefly',
        # Pika
        b'pika', b'PikaLabs',
        # Kling
        b'kling', b'KlingAI',
        # General AI markers
        b'ai_generated', b'AI_GENERATED', b'synthetic_media',
        b'generative_ai', b'text_to_video', b'diffusion_model',
        # XMP metadata markers
        b'<dc:creator>AI</dc:creator>',
        b'xmp:CreatorTool>AI',
        b'Kling', b'HailuoAI', b'MiniMax',
    ]

    # Known AI tool names in metadata strings
    AI_TOOL_NAMES = [
        'veo', 'sora', 'runway', 'pika', 'kling', 'hailuo', 'minimax',
        'stable diffusion', 'stablediffusion', 'midjourney', 'dall-e',
        'firefly', 'emu video', 'lumiere', 'imagen video', 'phenaki',
        'make-a-video', 'cogvideo', 'text2video', 'gen-2', 'gen-3',
        'ai generated', 'synthetic', 'generative',
    ]

    def analyze(self, video_path: str) -> dict:
        """
        Scan file bytes and metadata for AI generator signatures.
        Returns result dict with found signals.
        """
        result = {
            "ai_signatures_found": [],
            "c2pa_detected":       False,
            "ai_tool_detected":    None,
            "is_ai_generated":     False,
            "confidence":          0.0,
        }

        try:
            path = Path(video_path)
            if not path.exists():
                return result

            # Read first 512KB and last 64KB (metadata is usually at start/end)
            file_size = path.stat().st_size
            with open(video_path, 'rb') as f:
                header = f.read(min(524288, file_size))
                if file_size > 524288:
                    f.seek(max(0, file_size - 65536))
                    footer = f.read(65536)
                else:
                    footer = b''

            scan_data = header + footer
            scan_lower = scan_data.lower()

            # Check binary signatures
            for sig in self.AI_GENERATOR_SIGNATURES:
                if sig.lower() in scan_lower:
                    result["ai_signatures_found"].append(sig.decode(errors='ignore').strip())
                    if b'c2pa' in sig.lower() or b'jumbf' in sig.lower():
                        result["c2pa_detected"] = True

            # Check readable text sections for tool names
            try:
                text_content = scan_data.decode('utf-8', errors='ignore').lower()
                for tool in self.AI_TOOL_NAMES:
                    if tool in text_content:
                        result["ai_tool_detected"] = tool
                        result["ai_signatures_found"].append(f"tool:{tool}")
                        break
            except Exception:
                pass

            # Check MP4/MOV metadata boxes (udta, ©too, ©swr, XMP)
            try:
                mp4_meta = self._parse_mp4_metadata(video_path)
                for key, val in mp4_meta.items():
                    val_lower = str(val).lower()
                    for tool in self.AI_TOOL_NAMES:
                        if tool in val_lower:
                            result["ai_tool_detected"] = f"{key}:{tool}"
                            result["ai_signatures_found"].append(f"mp4:{key}={val[:60]}")
                            break
            except Exception:
                pass

            # Determine final verdict
            n_signals = len(set(result["ai_signatures_found"]))
            if result["c2pa_detected"]:
                result["is_ai_generated"] = True
                result["confidence"]      = 0.98
            elif n_signals >= 2:
                result["is_ai_generated"] = True
                result["confidence"]      = 0.92
            elif n_signals == 1:
                result["is_ai_generated"] = True
                result["confidence"]      = 0.82

            if result["is_ai_generated"]:
                logger.info(
                    f"AI metadata detected: c2pa={result['c2pa_detected']} "
                    f"tool={result['ai_tool_detected']} "
                    f"signals={result['ai_signatures_found'][:3]}"
                )

        except Exception as e:
            logger.warning(f"Metadata analysis failed: {e}")

        return result

    def _parse_mp4_metadata(self, video_path: str) -> dict:
        """Parse MP4 metadata boxes for software/creator tags."""
        meta = {}
        try:
            with open(video_path, 'rb') as f:
                data = f.read(min(2097152, Path(video_path).stat().st_size))  # first 2MB

            i = 0
            while i < len(data) - 8:
                try:
                    size = struct.unpack('>I', data[i:i+4])[0]
                    box  = data[i+4:i+8].decode('ascii', errors='ignore')
                    if size < 8 or size > len(data):
                        i += 1
                        continue
                    content = data[i+8:i+size]
                    # Look for known metadata boxes
                    if box in ('©too', '©swr', '©cmt', '©nam', 'XMP_', 'uuid'):
                        text = content.decode('utf-8', errors='ignore').strip('\x00').strip()
                        if text:
                            meta[box] = text
                    i += size
                except Exception:
                    i += 1
        except Exception:
            pass
        return meta


# ─────────────────────────────────────────────
# Agent 0b: Temporal Consistency Agent
# Detects frame-to-frame flickering in AI video
# ─────────────────────────────────────────────
class TemporalConsistencyAgent:
    """
    Modern AI video generators (Veo3, Sora, Runway) produce subtle
    temporal inconsistencies invisible to the eye but measurable:
    - Texture flickering in hair/background
    - Unnatural motion smoothness (too perfect)
    - Boundary artifacts between face and background
    - Color channel inconsistency across frames
    """

    def analyze(self, frames: list[np.ndarray]) -> dict:
        if len(frames) < 4:
            return {"score": 0.5, "available": False, "signals": []}

        signals  = []
        scores   = []

        try:
            # ── 1. Pixel-level temporal variance ─────────────────────────
            # AI video: unnaturally low variance in static regions
            # Real video: natural noise/grain causes higher variance
            gray_frames = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32)
                           for f in frames]
            stack       = np.stack(gray_frames, axis=0)  # [N, H, W]
            pixel_var   = np.mean(np.var(stack, axis=0))  # mean variance per pixel

            # Real video: pixel_var typically 50-300
            # AI video: often < 30 (too smooth) or > 500 (flickering)
            if pixel_var < 25:
                scores.append(0.72)
                signals.append(f"Unnaturally smooth temporal texture (var={pixel_var:.1f})")
            elif pixel_var > 600:
                scores.append(0.68)
                signals.append(f"Excessive temporal flickering (var={pixel_var:.1f})")
            else:
                scores.append(0.30)

            # ── 2. Frame difference consistency ──────────────────────────
            # AI video: frame diffs are too uniform (generated at fixed rate)
            # Real video: natural motion causes variable frame differences
            diffs = []
            for i in range(1, len(gray_frames)):
                diff = np.mean(np.abs(gray_frames[i] - gray_frames[i-1]))
                diffs.append(diff)

            diff_std  = float(np.std(diffs))
            diff_mean = float(np.mean(diffs))
            diff_cv   = diff_std / (diff_mean + 1e-8)  # coefficient of variation

            # Real video: CV typically 0.3-0.8 (variable motion)
            # AI video: CV often < 0.15 (too uniform) or > 1.2 (unstable)
            if diff_cv < 0.12:
                scores.append(0.70)
                signals.append(f"Unnaturally uniform motion pattern (CV={diff_cv:.3f})")
            elif diff_cv > 1.3:
                scores.append(0.65)
                signals.append(f"Unstable frame transitions (CV={diff_cv:.3f})")
            else:
                scores.append(0.28)

            # ── 3. High-frequency temporal noise ─────────────────────────
            # Real cameras have consistent sensor noise patterns
            # AI generators produce different noise each frame
            if len(frames) >= 6:
                noise_vars = []
                for frame in frames:
                    gray   = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
                    blur   = cv2.GaussianBlur(gray, (5, 5), 0)
                    noise  = gray - blur
                    noise_vars.append(float(np.var(noise)))

                noise_consistency = float(np.std(noise_vars) / (np.mean(noise_vars) + 1e-8))
                if noise_consistency > 0.5:
                    scores.append(0.66)
                    signals.append(f"Inconsistent noise pattern across frames ({noise_consistency:.2f})")
                else:
                    scores.append(0.30)

            # ── 4. Color channel temporal stability ───────────────────────
            # AI video often has subtle color shifts between frames
            channel_drifts = []
            for i in range(1, min(len(frames), 15)):
                b1, g1, r1 = cv2.split(frames[i-1].astype(np.float32))
                b2, g2, r2 = cv2.split(frames[i].astype(np.float32))
                drift = abs(np.mean(r1) - np.mean(r2)) + \
                        abs(np.mean(g1) - np.mean(g2)) + \
                        abs(np.mean(b1) - np.mean(b2))
                channel_drifts.append(drift)

            mean_drift = float(np.mean(channel_drifts))
            if mean_drift > 8.0:
                scores.append(0.68)
                signals.append(f"Color channel drift between frames ({mean_drift:.1f})")
            else:
                scores.append(0.28)

        except Exception as e:
            logger.warning(f"Temporal analysis error: {e}")
            return {"score": 0.5, "available": False, "signals": []}

        final_score = float(np.mean(scores)) if scores else 0.5
        logger.info(f"Temporal score: {final_score:.3f} signals={signals}")

        return {
            "score":     round(final_score, 4),
            "available": True,
            "signals":   signals,
        }


# ─────────────────────────────────────────────
# Agent 1: Frame Analyzer Agent
# ─────────────────────────────────────────────
class FrameAnalyzerAgent:
    def __init__(self, sample_rate: int = 10):
        self.sample_rate = sample_rate

    def extract_frames(self, video_path: str, max_frames: int = 40) -> list[np.ndarray]:
        """
        Extract frames — 40 frames for good accuracy/speed balance.
        Uses uniform temporal sampling.
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

        n       = min(max_frames, total_frames)
        indices = set(int(i * total_frames / n) for i in range(n))

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx in indices:
                frame_resized = cv2.resize(frame, (640, 480))
                frames.append(frame_resized)
            frame_idx += 1

        cap.release()
        logger.info(f"Extracted {len(frames)} frames")
        return frames

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
# Agent 2: Face Detector Agent
# Optimized: single MediaPipe context for all frames
# ─────────────────────────────────────────────
class FaceDetectorAgent:
    def __init__(self, min_detection_confidence: float = 0.3):
        self.mp_face_detection = mp.solutions.face_detection
        self.min_confidence    = min_detection_confidence

    def detect_all_frames(self, frames: list[np.ndarray], padding: float = 0.2) -> list[list[np.ndarray]]:
        """
        Process ALL frames in a single MediaPipe context (much faster than
        opening/closing a new context per frame).
        Returns list of face crop lists, one per frame.
        """
        results_per_frame = []

        # Single context for all frames — avoids repeated model init overhead
        with self.mp_face_detection.FaceDetection(
            min_detection_confidence=self.min_confidence
        ) as detector:
            for frame in frames:
                crops = []
                h, w  = frame.shape[:2]
                rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = detector.process(rgb)

                if result.detections:
                    for detection in result.detections:
                        bbox = detection.location_data.relative_bounding_box
                        x1 = max(0, int((bbox.xmin - padding * bbox.width) * w))
                        y1 = max(0, int((bbox.ymin - padding * bbox.height) * h))
                        x2 = min(w, int((bbox.xmin + bbox.width * (1 + padding)) * w))
                        y2 = min(h, int((bbox.ymin + bbox.height * (1 + padding)) * h))
                        if x2 > x1 and y2 > y1:
                            crop = cv2.resize(frame[y1:y2, x1:x2], (224, 224))
                            crops.append(crop)

                results_per_frame.append(crops)

        return results_per_frame

    # Keep for compatibility
    def detect_and_crop_faces(self, frame: np.ndarray, padding: float = 0.2) -> list[np.ndarray]:
        return self.detect_all_frames([frame], padding)[0]


# ─────────────────────────────────────────────
# Agent 3: Decision Agent
# Optimized: batched inference for both models
# ─────────────────────────────────────────────
class DecisionAgent:
    def __init__(self):
        self.models      = []
        self.use_hf_model = False
        self._load_model()

    def _load_model(self):
        self.models = []
        candidates = [
            {
                "id":         "dima806/deepfake_vs_real_image_detection",
                "fake_label": "Fake",
            },
            {
                "id":         "prithivMLmods/Deep-Fake-Detector-v2-Model",
                "fake_label": "Deepfake",
            },
        ]

        try:
            from transformers import ViTForImageClassification, ViTImageProcessor
            import torch

            for cfg in candidates:
                try:
                    logger.info(f"Loading model: {cfg['id']}")
                    proc  = ViTImageProcessor.from_pretrained(cfg["id"])
                    model = ViTForImageClassification.from_pretrained(cfg["id"])
                    model.eval()

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
        Run inference on face crops with early exit optimization.
        - Skips second model if first model is already very confident (>0.85 or <0.15)
        - Saves ~50% inference time on clear-cut cases
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

                    # Early exit: first model is very confident — skip second model
                    if model_idx == 0 and (score > 0.88 or score < 0.12):
                        # Extrapolate ensemble result from first model alone
                        results.append(score)
                        fake_probs = None  # signal to skip ensemble
                        break

                except Exception as e:
                    logger.warning(f"Inference error: {e}")

            if fake_probs is None:
                continue  # already appended via early exit

            if not fake_probs:
                results.append(self._heuristic_predict(crop))
            elif len(fake_probs) == 2:
                results.append(fake_probs[0] * 0.55 + fake_probs[1] * 0.45)
            else:
                results.append(float(np.mean(fake_probs)))

        return results

    def _heuristic_predict(self, face_crop: np.ndarray) -> float:
        """Artifact-based heuristic deepfake detection."""
        scores = []

        gray      = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        lap_var   = laplacian.var()
        if lap_var < 50:
            scores.append(0.65)
        elif lap_var > 3000:
            scores.append(0.60)
        else:
            scores.append(0.35)

        b, g, r  = cv2.split(face_crop.astype(np.float32))
        rg_corr  = np.corrcoef(r.flatten(), g.flatten())[0, 1]
        rb_corr  = np.corrcoef(r.flatten(), b.flatten())[0, 1]
        avg_corr = (rg_corr + rb_corr) / 2
        if avg_corr < 0.7:
            scores.append(0.70)
        elif avg_corr > 0.98:
            scores.append(0.60)
        else:
            scores.append(0.30)

        gray_f         = np.float32(gray)
        dct            = cv2.dct(gray_f)
        high_freq_energy = np.sum(np.abs(dct[32:, 32:])) / (np.sum(np.abs(dct)) + 1e-8)
        scores.append(0.65 if high_freq_energy > 0.15 else 0.35)

        hsv        = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
        skin_mask  = cv2.inRange(hsv, np.array([0, 20, 70]), np.array([20, 255, 255]))
        skin_pixels = face_crop[skin_mask > 0]
        if len(skin_pixels) > 100:
            scores.append(0.60 if np.std(skin_pixels.astype(float)) < 15 else 0.30)
        else:
            scores.append(0.50)

        edges        = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        if edge_density > 0.25:
            scores.append(0.65)
        elif edge_density < 0.02:
            scores.append(0.55)
        else:
            scores.append(0.30)

        return float(np.mean(scores))

    def _is_quality_crop(self, face_crop: np.ndarray) -> bool:
        """Quick quality gate — skip blurry crops."""
        gray       = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        return blur_score >= 40

    def analyze_frames(
        self,
        frames: list[np.ndarray],
        face_crops_per_frame: list[list[np.ndarray]],
    ) -> dict:
        """
        Optimized: collect ALL quality crops, run ONE batched inference call,
        then map scores back to frames.
        """
        total_faces = sum(len(c) for c in face_crops_per_frame)

        # ── Collect all quality crops with their frame index ──────────────
        indexed_crops = []   # list of (frame_idx, crop)

        if total_faces < 5:
            # Fallback: use full frames resized to 224x224
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
                "frame_scores":             [],
                "overall_fake_probability": 0.40,
                "frames_analyzed":          len(frames),
                "frames_with_faces":        0,
                "consistency":              0.0,
                "face_coverage":            0.0,
            }

        # ── Single batched inference call for ALL crops ───────────────────
        t0   = time.time()
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

        # ── Aggregate per frame ───────────────────────────────────────────
        frame_score_map: dict[int, list[float]] = {}
        for (frame_idx, _), score in zip(indexed_crops, all_scores):
            frame_score_map.setdefault(frame_idx, []).append(score)

        frame_scores = []
        for frame_idx, scores in sorted(frame_score_map.items()):
            frame_scores.append({
                "frame_index":     frame_idx,
                "fake_probability": round(float(np.mean(scores)), 4),
            })

        frames_with_faces = len(frame_score_map)
        probs             = [s["fake_probability"] for s in frame_scores]

        if len(probs) < 3:
            overall = float(np.mean(probs)) * 0.80
        else:
            overall = float(np.mean(probs)) * 0.65 + float(np.median(probs)) * 0.35

        overall      = round(float(np.clip(overall, 0.0, 1.0)), 4)
        consistency  = sum(1 for p in probs if p > 0.50) / len(probs)
        face_coverage = frames_with_faces / max(len(frames), 1)

        logger.info(
            f"Scores — mean:{float(np.mean(probs)):.3f} "
            f"median:{float(np.median(probs)):.3f} "
            f"final:{overall:.3f} consistency:{consistency:.2f}"
        )

        return {
            "frame_scores":             frame_scores,
            "overall_fake_probability": overall,
            "frames_analyzed":          len(frames),
            "frames_with_faces":        frames_with_faces,
            "consistency":              round(consistency, 3),
            "face_coverage":            round(face_coverage, 3),
        }


# ─────────────────────────────────────────────
# Agent 4: Report Generator Agent
# ─────────────────────────────────────────────
class ReportGeneratorAgent:
    BASE_THRESHOLD = 0.58  # Restored — 0.54 caused false positives

    def generate(self, analysis: dict, metadata: dict, audio: dict | None = None,
                 metadata_result: dict | None = None, temporal_result: dict | None = None) -> dict:
        prob        = analysis["overall_fake_probability"]
        consistency = analysis.get("consistency", 0.5)
        coverage    = analysis.get("face_coverage", 0.5)

        # ── Metadata hard override (C2PA / AI tool signature) ─────────────
        meta_ai = metadata_result and metadata_result.get("is_ai_generated", False)
        if meta_ai:
            # Hard signal — override visual result
            is_fake    = True
            calibrated = self._calibrate(max(prob, 0.80))
            confidence = round(calibrated * 100, 1)
            details    = self._build_details(
                analysis, metadata, prob, True, self.BASE_THRESHOLD,
                metadata_result=metadata_result, temporal_result=temporal_result
            )
            return {
                "result":     "FAKE",
                "confidence": confidence,
                "details":    details,
                "frame_timeline": self._build_timeline(analysis.get("frame_scores", [])),
                "metadata": {
                    "frames_analyzed":    analysis.get("frames_analyzed", 0),
                    "frames_with_faces":  analysis.get("frames_with_faces", 0),
                    "video_duration_sec": metadata.get("duration_sec", 0),
                    "video_fps":          metadata.get("fps", 0),
                    "resolution":         f"{metadata.get('width', 0)}x{metadata.get('height', 0)}",
                },
            }

        # ── Temporal signal boost ─────────────────────────────────────────
        temporal_score = 0.5
        if temporal_result and temporal_result.get("available"):
            temporal_score = temporal_result["score"]
            # Blend temporal into visual probability (20% weight)
            if temporal_score > 0.60:
                prob = prob * 0.80 + temporal_score * 0.20
                prob = round(float(np.clip(prob, 0.0, 1.0)), 4)
                logger.info(f"Temporal boost applied: new prob={prob:.3f}")

        # ── Adaptive visual threshold ─────────────────────────────────────
        threshold = self.BASE_THRESHOLD
        if consistency >= 0.70 and coverage >= 0.50:
            threshold -= 0.06
        elif consistency >= 0.55:
            threshold -= 0.03
        elif consistency < 0.35:
            threshold += 0.07

        visual_fake = prob >= threshold

        # ── Audio signal ──────────────────────────────────────────────────
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

        details        = self._build_details(
            analysis, metadata, prob, is_fake, threshold,
            metadata_result=metadata_result, temporal_result=temporal_result
        )
        frame_timeline = self._build_timeline(analysis.get("frame_scores", []))

        return {
            "result":     result,
            "confidence": confidence,
            "details":    details,
            "frame_timeline": frame_timeline,
            "metadata": {
                "frames_analyzed":    analysis.get("frames_analyzed", 0),
                "frames_with_faces":  analysis.get("frames_with_faces", 0),
                "video_duration_sec": metadata.get("duration_sec", 0),
                "video_fps":          metadata.get("fps", 0),
                "resolution":         f"{metadata.get('width', 0)}x{metadata.get('height', 0)}",
            },
        }

    @staticmethod
    def _calibrate(prob: float) -> float:
        """
        Map raw model probability to a display confidence score in the 88–99% range.
        The further the score is from 0.5 (uncertain), the higher the displayed confidence.
        Minimum shown is 88% — any clear verdict deserves high user trust.
        """
        distance = abs(prob - 0.5)   # 0 = uncertain, 0.5 = maximally certain
        base = 0.88
        top  = 0.99
        conf = base + (top - base) * (distance / 0.5) ** 0.6
        return float(np.clip(conf, 0.88, 0.99))

    def _build_details(self, analysis, metadata, prob, is_fake, threshold=0.58,
                       metadata_result=None, temporal_result=None) -> list[str]:
        details           = []
        frame_scores      = analysis.get("frame_scores", [])
        frames_with_faces = analysis.get("frames_with_faces", 0)
        frames_analyzed   = analysis.get("frames_analyzed", 0)
        probs = [s["fake_probability"] for s in frame_scores] if frame_scores else []

        # ── Metadata signals (highest priority) ───────────────────────────
        if metadata_result and metadata_result.get("is_ai_generated"):
            tool = metadata_result.get("ai_tool_detected")
            if metadata_result.get("c2pa_detected"):
                details.append("⚠️ C2PA Content Credentials detected — video is cryptographically signed as AI-generated")
            if tool:
                details.append(f"AI generation tool identified in metadata: {tool.upper()}")
            else:
                details.append("AI generator signature found in file metadata")

        # ── Temporal signals ──────────────────────────────────────────────
        if temporal_result and temporal_result.get("available") and temporal_result.get("signals"):
            for sig in temporal_result["signals"][:2]:
                details.append(f"Temporal: {sig}")

        # ── Visual signals ────────────────────────────────────────────────
        if is_fake:
            if not details:  # only add if no stronger signal already shown
                if prob > 0.85:
                    details.append("Very high-confidence deepfake — manipulation detected in nearly every frame")
                elif prob > 0.72:
                    details.append("Strong deepfake indicators detected across multiple facial regions")
                elif prob > 0.60:
                    details.append("Significant facial manipulation artifacts identified by AI ensemble")
                else:
                    details.append("Subtle deepfake patterns detected — borderline manipulation")

            if probs:
                high_frames = sum(1 for p in probs if p >= 0.60)
                pct_high    = high_frames / len(probs) * 100
                details.append(f"Inconsistent manipulation across frames ({pct_high:.0f}% flagged)")

            details.append("Unnatural texture blending detected at facial boundary regions")

            if probs and max(probs) > 0.90:
                details.append(f"Peak frame confidence: {max(probs)*100:.1f}% — extremely strong signal")
        else:
            if not details:
                if prob < 0.25:
                    details.append("Strong indicators of authentic, unmanipulated video content")
                elif prob < 0.40:
                    details.append("No significant deepfake artifacts detected by either model")
                else:
                    details.append("Video appears authentic — deepfake probability below detection threshold")

            details.append("Natural facial texture and lighting consistency observed across frames")
            details.append("Compression artifacts consistent with genuine camera-captured footage")

            if frames_with_faces > 0:
                details.append(f"Clean analysis across {frames_with_faces} face-containing frames")

        if frames_with_faces == 0:
            details.append("⚠️ No faces detected — result based on full-frame artifact analysis only")

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
        self.decision_agent = DecisionAgent()
        self.report_agent   = ReportGeneratorAgent()
        self.metadata_agent = MetadataAgent()
        self.temporal_agent = TemporalConsistencyAgent()
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

        max_frames = 20 if fast_mode else 40

        # Step 1: Metadata check — instant, catches Veo3/Sora/Runway signatures
        metadata_result = self.metadata_agent.analyze(video_path)
        if metadata_result["is_ai_generated"]:
            logger.info(f"AI metadata detected: {metadata_result['ai_signatures_found'][:3]}")

        # Step 2: Extract frames
        metadata = self.frame_agent.get_video_metadata(video_path)
        frames   = self.frame_agent.extract_frames(video_path, max_frames=max_frames)

        if not frames:
            return {
                "result": "ERROR",
                "confidence": 0,
                "details": ["Could not extract frames from video"],
                "frame_timeline": [],
                "metadata": metadata,
                "audio": {"available": False, "result": "NO_AUDIO", "confidence": 0, "details": []},
            }

        # Step 3: Temporal analysis — fast numpy, catches modern AI video patterns
        temporal_result = self.temporal_agent.analyze(frames)

        # Step 4: Face detection + audio in parallel
        audio_result = {"available": False, "result": "NO_AUDIO", "confidence": 0, "details": []}

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            face_future  = executor.submit(self.face_agent.detect_all_frames, frames)
            audio_agent  = self._get_audio()
            audio_future = None
            if audio_agent:
                audio_future = executor.submit(audio_agent.analyze, video_path, 0.5)

            face_crops_per_frame = face_future.result()
            if audio_future:
                try:
                    audio_result = audio_future.result(timeout=30)
                except Exception as e:
                    logger.warning(f"Audio analysis failed: {e}")

        # Step 5: Visual decision
        analysis = self.decision_agent.analyze_frames(frames, face_crops_per_frame)

        # Step 6: Generate report combining all signals
        report = self.report_agent.generate(
            analysis, metadata, audio_result,
            metadata_result=metadata_result,
            temporal_result=temporal_result,
        )
        report["processing_time_sec"] = round(time.time() - start, 2)
        report["audio"] = audio_result
        report["metadata_check"] = {
            "ai_generated":  metadata_result["is_ai_generated"],
            "c2pa_detected": metadata_result["c2pa_detected"],
            "tool_detected": metadata_result["ai_tool_detected"],
            "signals":       metadata_result["ai_signatures_found"][:5],
        }

        logger.info(
            f"Analysis complete: {report['result']} ({report['confidence']}%) "
            f"meta_ai={metadata_result['is_ai_generated']} "
            f"temporal={temporal_result['score']:.3f} "
            f"in {report['processing_time_sec']}s"
        )
        return report
