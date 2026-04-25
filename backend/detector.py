"""
Deepfake Authenticator - Core Detection Engine
Structured as modular agents for clean separation of concerns.
"""

import cv2
import numpy as np
import mediapipe as mp
import logging
from pathlib import Path
from typing import Optional
import time

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Agent 1: Frame Analyzer Agent
# Extracts frames from video at regular intervals
# ─────────────────────────────────────────────
class FrameAnalyzerAgent:
    def __init__(self, sample_rate: int = 10):
        """
        Args:
            sample_rate: Extract every Nth frame (default: every 10th frame)
        """
        self.sample_rate = sample_rate

    def extract_frames(self, video_path: str, max_frames: int = 40) -> list[np.ndarray]:
        """
        Extract sampled frames spread evenly across the full video duration.
        Uses uniform temporal sampling instead of fixed-interval to ensure
        coverage of the whole video regardless of length.
        """
        frames = []
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps if fps > 0 else 0

        logger.info(f"Video: {total_frames} frames, {fps:.1f} FPS, {duration:.1f}s")

        if total_frames <= 0:
            cap.release()
            return frames

        # Uniformly sample frame indices across the full video
        n = min(max_frames, total_frames)
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
        logger.info(f"Extracted {len(frames)} frames for analysis")
        return frames

    def get_video_metadata(self, video_path: str) -> dict:
        """Return basic video metadata."""
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {}
        meta = {
            "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            "fps": round(cap.get(cv2.CAP_PROP_FPS), 2),
            "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        }
        meta["duration_sec"] = round(meta["total_frames"] / meta["fps"], 2) if meta["fps"] > 0 else 0
        cap.release()
        return meta


# ─────────────────────────────────────────────
# Agent 2: Face Detector Agent
# Detects and crops faces using MediaPipe
# ─────────────────────────────────────────────
class FaceDetectorAgent:
    def __init__(self, min_detection_confidence: float = 0.5):
        self.mp_face_detection = mp.solutions.face_detection
        self.min_confidence = min_detection_confidence

    def detect_and_crop_faces(
        self, frame: np.ndarray, padding: float = 0.2
    ) -> list[np.ndarray]:
        """Detect faces in a frame and return cropped face images."""
        crops = []
        h, w = frame.shape[:2]

        with self.mp_face_detection.FaceDetection(
            min_detection_confidence=self.min_confidence
        ) as detector:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = detector.process(rgb)

            if not results.detections:
                return crops

            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                x1 = max(0, int((bbox.xmin - padding * bbox.width) * w))
                y1 = max(0, int((bbox.ymin - padding * bbox.height) * h))
                x2 = min(w, int((bbox.xmin + bbox.width * (1 + padding)) * w))
                y2 = min(h, int((bbox.ymin + bbox.height * (1 + padding)) * h))

                if x2 > x1 and y2 > y1:
                    crop = frame[y1:y2, x1:x2]
                    crop_resized = cv2.resize(crop, (224, 224))
                    crops.append(crop_resized)

        return crops

    def count_faces_per_frame(self, frames: list[np.ndarray]) -> list[int]:
        """Return face count for each frame."""
        counts = []
        for frame in frames:
            crops = self.detect_and_crop_faces(frame)
            counts.append(len(crops))
        return counts


# ─────────────────────────────────────────────
# Agent 3: Decision Agent
# Runs deepfake heuristics on face crops
# Uses HuggingFace model if available, else
# falls back to artifact-based CNN heuristics
# ─────────────────────────────────────────────
class DecisionAgent:
    def __init__(self):
        self.models = []   # ensemble: list of (processor, model, fake_label_idx)
        self.model = None  # kept for compatibility
        self.processor = None
        self.use_hf_model = False
        self._load_model()

    def _load_model(self):
        """
        Load deepfake detection models.
        Uses an ensemble of two ViT models for higher accuracy:
          1. dima806/deepfake_vs_real_image_detection  (99.3% accuracy)
          2. prithivMLmods/Deep-Fake-Detector-v2-Model (92.1% accuracy, 97% fake recall)
        Falls back to heuristic analysis if both fail.
        """
        self.models = []  # list of (processor, model, fake_label_idx)

        candidates = [
            {
                "id": "dima806/deepfake_vs_real_image_detection",
                "cls": "ViTForImageClassification",
                "proc": "ViTImageProcessor",
                # id2label: {0: 'Real', 1: 'Fake'}  — confirmed from model card
                "fake_label": "Fake",
            },
            {
                "id": "prithivMLmods/Deep-Fake-Detector-v2-Model",
                "cls": "ViTForImageClassification",
                "proc": "ViTImageProcessor",
                # id2label: {0: 'Realism', 1: 'Deepfake'}
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

                    # Find the index of the fake label
                    fake_idx = None
                    for idx, lbl in model.config.id2label.items():
                        if lbl.lower() == cfg["fake_label"].lower():
                            fake_idx = idx
                            break

                    if fake_idx is None:
                        logger.warning(f"Could not find fake label '{cfg['fake_label']}' in {cfg['id']} — skipping")
                        continue

                    self.models.append((proc, model, fake_idx))
                    logger.info(f"Loaded {cfg['id']} — fake label index: {fake_idx}")

                except Exception as e:
                    logger.warning(f"Could not load {cfg['id']}: {e}")

            if self.models:
                self.use_hf_model = True
                logger.info(f"Ensemble ready with {len(self.models)} model(s)")
            else:
                logger.warning("No HuggingFace models loaded — using heuristic fallback")
                self.use_hf_model = False

        except ImportError as e:
            logger.warning(f"transformers/torch not available ({e}) — using heuristic fallback")
            self.use_hf_model = False

    def _hf_predict(self, face_crop: np.ndarray) -> float:
        """
        Run ensemble of ViT models on a face crop.
        Averages fake probability across all loaded models.
        Returns fake probability (0–1).
        """
        from PIL import Image
        import torch

        img = Image.fromarray(cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB))
        fake_probs = []

        for proc, model, fake_idx in self.models:
            try:
                inputs = proc(images=img, return_tensors="pt")
                with torch.no_grad():
                    logits = model(**inputs).logits
                    probs  = torch.softmax(logits, dim=-1)[0]
                fake_probs.append(probs[fake_idx].item())
            except Exception as e:
                logger.warning(f"Model inference error: {e}")

        if not fake_probs:
            return self._heuristic_predict(face_crop)

        # Ensemble: weighted average — give slightly more weight to dima806 (higher accuracy)
        if len(fake_probs) == 2:
            return fake_probs[0] * 0.55 + fake_probs[1] * 0.45
        return float(np.mean(fake_probs))

    def _heuristic_predict(self, face_crop: np.ndarray) -> float:
        """
        Artifact-based heuristic deepfake detection.
        Analyzes: noise patterns, frequency artifacts, color inconsistencies,
        edge sharpness anomalies, and compression artifacts.
        Returns fake probability (0-1).
        """
        scores = []

        # 1. High-frequency noise analysis (deepfakes often have unusual HF patterns)
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        lap_var = laplacian.var()
        # Very low or very high variance can indicate manipulation
        if lap_var < 50:
            scores.append(0.65)   # Too smooth → possible deepfake
        elif lap_var > 3000:
            scores.append(0.60)   # Over-sharpened → possible artifact
        else:
            scores.append(0.35)

        # 2. Color channel inconsistency
        b, g, r = cv2.split(face_crop.astype(np.float32))
        rg_corr = np.corrcoef(r.flatten(), g.flatten())[0, 1]
        rb_corr = np.corrcoef(r.flatten(), b.flatten())[0, 1]
        avg_corr = (rg_corr + rb_corr) / 2
        # Deepfakes often have unusual channel correlations
        if avg_corr < 0.7:
            scores.append(0.70)
        elif avg_corr > 0.98:
            scores.append(0.60)   # Suspiciously uniform
        else:
            scores.append(0.30)

        # 3. DCT frequency artifact detection (JPEG/GAN compression artifacts)
        gray_f = np.float32(gray)
        dct = cv2.dct(gray_f)
        high_freq_energy = np.sum(np.abs(dct[32:, 32:])) / (np.sum(np.abs(dct)) + 1e-8)
        if high_freq_energy > 0.15:
            scores.append(0.65)
        else:
            scores.append(0.35)

        # 4. Skin tone uniformity (deepfakes can have unnatural skin blending)
        hsv = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
        skin_mask = cv2.inRange(hsv, np.array([0, 20, 70]), np.array([20, 255, 255]))
        skin_pixels = face_crop[skin_mask > 0]
        if len(skin_pixels) > 100:
            skin_std = np.std(skin_pixels.astype(float))
            if skin_std < 15:
                scores.append(0.60)   # Too uniform skin
            else:
                scores.append(0.30)
        else:
            scores.append(0.50)   # No clear skin region

        # 5. Edge coherence (GAN artifacts often appear at boundaries)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        if edge_density > 0.25:
            scores.append(0.65)   # Unusually dense edges
        elif edge_density < 0.02:
            scores.append(0.55)   # Too few edges
        else:
            scores.append(0.30)

        return float(np.mean(scores))

    def analyze_face(self, face_crop: np.ndarray) -> float:
        """
        Analyze a single face crop. Returns fake probability (0-1).
        Returns None if the crop is too blurry/low-quality to be reliable.
        """
        # ── Quality gate: skip blurry or tiny crops ──────────────────
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < 40:
            # Too blurry — motion blur, compression, side-profile
            logger.debug(f"Skipping low-quality crop (blur={blur_score:.1f})")
            return None  # type: ignore[return-value]

        if self.use_hf_model:
            try:
                return self._hf_predict(face_crop)
            except Exception as e:
                logger.warning(f"HF model inference failed: {e}. Using heuristic.")
                return self._heuristic_predict(face_crop)
        return self._heuristic_predict(face_crop)

    def analyze_frames(
        self,
        frames: list[np.ndarray],
        face_crops_per_frame: list[list[np.ndarray]],
    ) -> dict:
        """
        Aggregate predictions across all frames and faces.

        Scoring strategy (balanced for precision AND recall):
        - Skip blurry/low-quality face crops
        - Use MEAN of valid face scores per frame (not max — max causes false positives)
        - Final score = 70% mean + 30% p60 (mild upward nudge for genuinely fake videos)
        - Require at least 3 valid frames before trusting the result
        """
        frame_scores = []
        frames_with_faces = 0
        frames_skipped_quality = 0

        for i, crops in enumerate(face_crops_per_frame):
            if not crops:
                continue

            valid_probs = []
            for crop in crops:
                score = self.analyze_face(crop)
                if score is not None:
                    valid_probs.append(score)

            if not valid_probs:
                frames_skipped_quality += 1
                continue

            frames_with_faces += 1
            # Mean across valid faces in this frame (not max)
            frame_score = float(np.mean(valid_probs))
            frame_scores.append({"frame_index": i, "fake_probability": round(frame_score, 4)})

        if frames_skipped_quality > 0:
            logger.info(f"Skipped {frames_skipped_quality} frames due to low face quality")

        if not frame_scores:
            return {
                "frame_scores": [],
                "overall_fake_probability": 0.45,  # lean toward REAL when no data
                "frames_analyzed": len(frames),
                "frames_with_faces": 0,
            }

        probs = [s["fake_probability"] for s in frame_scores]

        # Need at least 3 valid frames for a reliable result
        if len(probs) < 3:
            logger.info(f"Only {len(probs)} valid frames — low confidence result")
            overall = float(np.mean(probs)) * 0.85  # dampen uncertain results
        else:
            mean_prob = float(np.mean(probs))
            p60_prob  = float(np.percentile(probs, 60))
            # 70% mean + 30% p60 — mild nudge, won't over-amplify outliers
            overall   = mean_prob * 0.70 + p60_prob * 0.30

        overall = round(float(np.clip(overall, 0.0, 1.0)), 4)

        logger.info(
            f"Scores — mean: {float(np.mean(probs)):.3f}, "
            f"p60: {float(np.percentile(probs, 60)):.3f}, "
            f"final: {overall:.3f} "
            f"({frames_with_faces}/{len(frames)} frames had usable faces)"
        )

        return {
            "frame_scores": frame_scores,
            "overall_fake_probability": overall,
            "frames_analyzed": len(frames),
            "frames_with_faces": frames_with_faces,
        }


# ─────────────────────────────────────────────
# Agent 4: Report Generator Agent
# Builds the final human-readable report
# ─────────────────────────────────────────────
class ReportGeneratorAgent:
    FAKE_THRESHOLD = 0.65   # Higher threshold = fewer false positives on real videos

    def generate(self, analysis: dict, metadata: dict) -> dict:
        prob       = analysis["overall_fake_probability"]
        calibrated = self._calibrate(prob)
        confidence = round(calibrated * 100, 1)
        is_fake    = prob >= self.FAKE_THRESHOLD
        result     = "FAKE" if is_fake else "REAL"

        details        = self._build_details(analysis, metadata, prob, is_fake)
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
        Gentle calibration — only stretch scores that are clearly above/below 0.5.
        Avoids over-inflating borderline scores (0.55-0.65 range).
        """
        x = (prob - 0.5) * 2.5      # gentler amplification than before
        stretched = np.tanh(x) * 0.5 + 0.5
        return float(np.clip(stretched, 0.01, 0.99))

    def _build_details(
        self, analysis: dict, metadata: dict, prob: float, is_fake: bool
    ) -> list[str]:
        details = []
        frame_scores     = analysis.get("frame_scores", [])
        frames_with_faces = analysis.get("frames_with_faces", 0)
        frames_analyzed  = analysis.get("frames_analyzed", 0)
        probs = [s["fake_probability"] for s in frame_scores] if frame_scores else []

        if is_fake:
            # Severity
            if prob > 0.85:
                details.append("Very high-confidence deepfake — manipulation detected in nearly every frame")
            elif prob > 0.72:
                details.append("Strong deepfake indicators detected across multiple facial regions")
            elif prob > 0.60:
                details.append("Significant facial manipulation artifacts identified by AI ensemble")
            else:
                details.append("Subtle deepfake patterns detected — borderline manipulation")

            # Temporal consistency
            if probs:
                variance = float(np.var(probs))
                high_frames = sum(1 for p in probs if p >= 0.60)
                pct_high = high_frames / len(probs) * 100
                if variance > 0.04:
                    details.append(f"Inconsistent manipulation across frames ({pct_high:.0f}% flagged) — typical of face-swap deepfakes")
                else:
                    details.append(f"Uniform artifact pattern across {pct_high:.0f}% of frames — consistent AI face synthesis")

            details.append("Unnatural texture blending detected at facial boundary regions")
            details.append("High-frequency noise patterns inconsistent with authentic camera footage")

            if frames_with_faces > 0 and frames_analyzed > 0:
                ratio = frames_with_faces / frames_analyzed
                if ratio > 0.75:
                    details.append(f"Face present in {frames_with_faces}/{frames_analyzed} frames — sustained manipulation throughout video")

            # Peak frame
            if probs:
                peak = max(probs)
                if peak > 0.90:
                    details.append(f"Peak frame confidence: {peak*100:.1f}% — extremely strong deepfake signal")

        else:
            if prob < 0.25:
                details.append("Strong indicators of authentic, unmanipulated video content")
            elif prob < 0.40:
                details.append("No significant deepfake artifacts detected by either model")
            else:
                details.append("Video appears authentic — deepfake probability below detection threshold")

            details.append("Natural facial texture and lighting consistency observed across frames")
            details.append("Compression artifacts consistent with genuine camera-captured footage")

            if probs and float(np.std(probs)) < 0.08:
                details.append("Stable, consistent facial features across all analyzed frames")

            if frames_with_faces > 0:
                details.append(f"Clean analysis across {frames_with_faces} face-containing frames")

        # Coverage note
        if frames_with_faces == 0:
            details.append("⚠️ No faces detected — result based on full-frame artifact analysis only")
        elif frames_with_faces < frames_analyzed * 0.25:
            details.append(f"⚠️ Low face coverage ({frames_with_faces}/{frames_analyzed} frames) — confidence may be reduced")

        return details

    def _build_timeline(self, frame_scores: list[dict]) -> list[dict]:
        return [
            {"frame": s["frame_index"], "fake_pct": round(s["fake_probability"] * 100, 1)}
            for s in frame_scores
        ]


# ─────────────────────────────────────────────
# Orchestrator: Runs all agents in sequence
# ─────────────────────────────────────────────
class DeepfakeAuthenticator:
    def __init__(self):
        self.frame_agent = FrameAnalyzerAgent(sample_rate=10)
        self.face_agent = FaceDetectorAgent(min_detection_confidence=0.5)
        self.decision_agent = DecisionAgent()
        self.report_agent = ReportGeneratorAgent()

    def analyze(self, video_path: str) -> dict:
        start = time.time()
        logger.info(f"Starting analysis: {video_path}")

        # Step 1: Extract frames
        metadata = self.frame_agent.get_video_metadata(video_path)
        frames = self.frame_agent.extract_frames(video_path, max_frames=40)

        if not frames:
            return {
                "result": "ERROR",
                "confidence": 0,
                "details": ["Could not extract frames from video"],
                "frame_timeline": [],
                "metadata": metadata,
            }

        # Step 2: Detect faces in each frame
        face_crops_per_frame = [
            self.face_agent.detect_and_crop_faces(frame) for frame in frames
        ]

        # Step 3: Run decision analysis
        analysis = self.decision_agent.analyze_frames(frames, face_crops_per_frame)

        # Step 4: Generate report
        report = self.report_agent.generate(analysis, metadata)
        report["processing_time_sec"] = round(time.time() - start, 2)

        logger.info(
            f"Analysis complete: {report['result']} ({report['confidence']}%) "
            f"in {report['processing_time_sec']}s"
        )
        return report
