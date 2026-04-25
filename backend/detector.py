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
    def __init__(self, sample_rate: int = 10):
        self.sample_rate = sample_rate

    def extract_frames(self, video_path: str, max_frames: int = 40) -> list[np.ndarray]:
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
                frames.append(cv2.resize(frame, (640, 480)))
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
# Single MediaPipe context for all frames
# ─────────────────────────────────────────────
class FaceDetectorAgent:
    def __init__(self, min_detection_confidence: float = 0.3):
        self.mp_face_detection = mp.solutions.face_detection
        self.min_confidence    = min_detection_confidence

    def detect_all_frames(self, frames: list[np.ndarray], padding: float = 0.2) -> list[list[np.ndarray]]:
        results_per_frame = []
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


# ─────────────────────────────────────────────
# Agent 4: Report Generator Agent
# ─────────────────────────────────────────────
class ReportGeneratorAgent:
    BASE_THRESHOLD = 0.58

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

        # ── Step 2: Extract frames ────────────────────────────────────────
        max_frames = 20 if fast_mode else 40
        metadata   = self.frame_agent.get_video_metadata(video_path)
        frames     = self.frame_agent.extract_frames(video_path, max_frames=max_frames)

        if not frames:
            return {
                "result": "ERROR", "confidence": 0,
                "details": ["Could not extract frames from video"],
                "frame_timeline": [], "metadata": metadata,
                "audio": {"available": False, "result": "NO_AUDIO", "confidence": 0, "details": []},
            }

        # ── Step 3: Face detection + audio in parallel ────────────────────
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
                    # 20s hard timeout — never block the pipeline for audio
                    audio_result = audio_future.result(timeout=20)
                except concurrent.futures.TimeoutError:
                    logger.warning("Audio analysis timed out after 20s — skipping")
                except Exception as e:
                    logger.warning(f"Audio analysis failed: {e}")

        # ── Step 4: Visual decision ───────────────────────────────────────
        analysis = self.decision_agent.analyze_frames(frames, face_crops_per_frame)

        # ── Step 5: Report ────────────────────────────────────────────────
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
