"""
Deepfake Authenticator — Audio Analysis Agent
Detects AI-generated / synthetic voices from video audio tracks.

Pipeline:
  1. AudioExtractorAgent  — extracts audio from video via moviepy
  2. AudioAnalysisAgent   — librosa heuristics (MFCC, pitch, spectral)
  3. AudioDecisionAgent   — Wav2Vec2 model (Bisher/wav2vec2_ASV_deepfake_audio_detection)
  4. AudioReportAgent     — builds structured result
"""

import os
import tempfile
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Agent 1: Audio Extractor
# Pulls audio track from video file
# ─────────────────────────────────────────────
class AudioExtractorAgent:
    TARGET_SR = 16000   # Wav2Vec2 expects 16kHz

    def extract(self, video_path: str) -> tuple[np.ndarray | None, int]:
        """
        Extract mono 16kHz audio from video.
        Returns (waveform_array, sample_rate) or (None, 0) if no audio.
        """
        try:
            from moviepy import VideoFileClip
        except ImportError:
            try:
                from moviepy.editor import VideoFileClip
            except ImportError:
                logger.warning("moviepy not installed — audio analysis skipped")
                return None, 0

        tmp_wav = None
        try:
            clip = VideoFileClip(video_path)
            if clip.audio is None:
                logger.info("Video has no audio track")
                clip.close()
                return None, 0

            # Write to temp WAV
            tmp_wav = tempfile.mktemp(suffix=".wav")
            clip.audio.write_audiofile(
                tmp_wav,
                fps=self.TARGET_SR,
                nbytes=2,
                codec="pcm_s16le",
                logger=None,
            )
            clip.close()

            # Load with soundfile for clean numpy array
            import soundfile as sf
            waveform, sr = sf.read(tmp_wav, dtype="float32")

            # Convert stereo → mono
            if waveform.ndim > 1:
                waveform = waveform.mean(axis=1)

            # Resample if needed
            if sr != self.TARGET_SR:
                import torchaudio
                import torch
                t = torch.from_numpy(waveform).unsqueeze(0)
                resampler = torchaudio.transforms.Resample(sr, self.TARGET_SR)
                waveform = resampler(t).squeeze(0).numpy()
                sr = self.TARGET_SR

            logger.info(f"Audio extracted: {len(waveform)/sr:.1f}s @ {sr}Hz")
            return waveform, sr

        except Exception as e:
            logger.warning(f"Audio extraction failed: {e}")
            return None, 0
        finally:
            if tmp_wav and os.path.exists(tmp_wav):
                os.unlink(tmp_wav)


# ─────────────────────────────────────────────
# Agent 2: Audio Heuristic Analyzer
# Librosa-based feature analysis
# ─────────────────────────────────────────────
class AudioAnalysisAgent:
    """
    Detects AI voice artifacts using signal processing:
    - Pitch variance (AI voices are unnaturally consistent)
    - MFCC delta variance (AI lacks natural micro-variations)
    - Spectral flatness (AI voices have unusual spectral distribution)
    - Zero-crossing rate (synthetic voices differ in ZCR patterns)
    - Silence/breath ratio (AI voices often lack natural breath sounds)
    """

    def analyze(self, waveform: np.ndarray, sr: int) -> dict:
        try:
            import librosa
        except ImportError:
            logger.warning("librosa not installed — heuristic audio analysis skipped")
            return {"heuristic_fake_prob": 0.5, "features": {}, "available": False}

        scores = []
        features = {}

        # ── 1. Pitch variance ─────────────────────────────────────────
        # AI voices have unnaturally stable pitch (low variance = suspicious)
        try:
            f0, voiced_flag, _ = librosa.pyin(
                waveform, fmin=50, fmax=500, sr=sr
            )
            voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]
            if len(voiced_f0) > 10:
                pitch_std = float(np.std(voiced_f0))
                features["pitch_std_hz"] = round(pitch_std, 2)
                # Real human speech: std typically 20-80 Hz
                # AI voices: often < 10 Hz (too stable)
                if pitch_std < 8:
                    scores.append(0.80)   # Very suspicious
                elif pitch_std < 15:
                    scores.append(0.65)
                elif pitch_std < 25:
                    scores.append(0.45)
                else:
                    scores.append(0.25)   # Natural variation
            else:
                scores.append(0.50)
        except Exception as e:
            logger.debug(f"Pitch analysis failed: {e}")
            scores.append(0.50)

        # ── 2. MFCC delta variance ────────────────────────────────────
        # AI voices lack natural micro-variations in articulation
        try:
            mfcc = librosa.feature.mfcc(y=waveform, sr=sr, n_mfcc=13)
            delta = librosa.feature.delta(mfcc)
            delta_var = float(np.mean(np.var(delta, axis=1)))
            features["mfcc_delta_var"] = round(delta_var, 4)
            # Low delta variance → unnaturally smooth transitions
            if delta_var < 0.5:
                scores.append(0.75)
            elif delta_var < 1.5:
                scores.append(0.55)
            elif delta_var < 4.0:
                scores.append(0.35)
            else:
                scores.append(0.20)
        except Exception as e:
            logger.debug(f"MFCC analysis failed: {e}")
            scores.append(0.50)

        # ── 3. Spectral flatness ──────────────────────────────────────
        # AI voices often have unusual spectral distribution
        try:
            flatness = librosa.feature.spectral_flatness(y=waveform)
            mean_flatness = float(np.mean(flatness))
            features["spectral_flatness"] = round(mean_flatness, 4)
            # Very low flatness = tonal (could be AI), very high = noisy
            if mean_flatness < 0.001:
                scores.append(0.65)
            elif mean_flatness < 0.005:
                scores.append(0.45)
            else:
                scores.append(0.30)
        except Exception as e:
            logger.debug(f"Spectral flatness failed: {e}")
            scores.append(0.50)

        # ── 4. Zero-crossing rate consistency ────────────────────────
        # AI voices have unnaturally consistent ZCR
        try:
            zcr = librosa.feature.zero_crossing_rate(waveform)
            zcr_std = float(np.std(zcr))
            features["zcr_std"] = round(zcr_std, 4)
            if zcr_std < 0.02:
                scores.append(0.65)   # Too consistent
            elif zcr_std < 0.05:
                scores.append(0.40)
            else:
                scores.append(0.25)
        except Exception as e:
            logger.debug(f"ZCR analysis failed: {e}")
            scores.append(0.50)

        # ── 5. Silence/breath detection ───────────────────────────────
        # Real speech has natural pauses and breath sounds
        # AI voices often have perfectly clean silence or no breaths
        try:
            rms = librosa.feature.rms(y=waveform)[0]
            silence_ratio = float(np.mean(rms < 0.01))
            features["silence_ratio"] = round(silence_ratio, 3)
            # Very low silence ratio = no natural pauses (suspicious)
            # Very high = mostly silent (not useful)
            if silence_ratio < 0.05:
                scores.append(0.60)   # No natural pauses
            elif 0.05 <= silence_ratio <= 0.35:
                scores.append(0.25)   # Natural speech rhythm
            else:
                scores.append(0.45)
        except Exception as e:
            logger.debug(f"Silence analysis failed: {e}")
            scores.append(0.50)

        heuristic_prob = float(np.mean(scores)) if scores else 0.5
        logger.info(f"Audio heuristics: {features} → fake_prob={heuristic_prob:.3f}")

        return {
            "heuristic_fake_prob": round(heuristic_prob, 4),
            "features": features,
            "available": True,
        }


# ─────────────────────────────────────────────
# Agent 3: Audio Decision Agent
# Wav2Vec2 model for AI voice detection
# ─────────────────────────────────────────────
class AudioDecisionAgent:
    # Primary: ASVspoof-trained model with bonafide/spoof labels
    MODEL_ID   = "Vansh180/deepfake-audio-wav2vec2"
    CHUNK_SEC  = 10
    TARGET_SR  = 16000

    def __init__(self):
        self.model     = None
        self.processor = None
        self.fake_idx  = 1   # default: label 1 = spoof/fake
        self.available = False
        self._load()

    def _load(self):
        try:
            from transformers import (
                AutoModelForAudioClassification,
                AutoFeatureExtractor,
            )
            logger.info(f"Loading audio model: {self.MODEL_ID}")
            self.processor = AutoFeatureExtractor.from_pretrained(self.MODEL_ID)
            self.model     = AutoModelForAudioClassification.from_pretrained(self.MODEL_ID)
            self.model.eval()

            # Find fake/spoof label index
            for idx, lbl in self.model.config.id2label.items():
                lbl_lower = lbl.lower()
                if any(w in lbl_lower for w in ("fake", "spoof", "synthetic", "generated")):
                    self.fake_idx = idx
                    break

            self.available = True
            logger.info(
                f"Audio model loaded — labels={self.model.config.id2label} "
                f"fake_idx={self.fake_idx}"
            )
        except Exception as e:
            logger.warning(f"Audio model unavailable: {e}")
            self.available = False

    def predict(self, waveform: np.ndarray, sr: int) -> float:
        """Run model on audio chunks, return mean fake probability."""
        if not self.available:
            return 0.5

        import torch

        chunk_size = self.CHUNK_SEC * sr
        chunks = [
            waveform[i : i + chunk_size]
            for i in range(0, len(waveform), chunk_size)
            if len(waveform[i : i + chunk_size]) > sr // 2
        ]

        if not chunks:
            return 0.5

        fake_probs = []
        for chunk in chunks:
            try:
                inputs = self.processor(
                    chunk,
                    sampling_rate=self.TARGET_SR,
                    return_tensors="pt",
                    padding=True,
                )
                with torch.no_grad():
                    logits = self.model(**inputs).logits
                    probs  = torch.softmax(logits, dim=-1)[0]
                fake_probs.append(probs[self.fake_idx].item())
            except Exception as e:
                logger.warning(f"Audio chunk inference failed: {e}")

        if not fake_probs:
            return 0.5

        result = float(np.mean(fake_probs))
        logger.info(f"Audio model: {len(fake_probs)} chunks → fake_prob={result:.3f}")
        return result


# ─────────────────────────────────────────────
# Agent 4: Audio Report Agent
# Builds structured audio result
# ─────────────────────────────────────────────
class AudioReportAgent:
    FAKE_THRESHOLD = 0.60

    def generate(
        self,
        model_prob: float,
        heuristic: dict,
        has_audio: bool,
        visual_fake_prob: float = 0.5,
    ) -> dict:
        if not has_audio:
            return {
                "available": False,
                "result": "NO_AUDIO",
                "confidence": 0,
                "fake_probability": 0,
                "details": ["No audio track found in video"],
            }

        heur_prob = heuristic.get("heuristic_fake_prob", 0.5)
        features  = heuristic.get("features", {})

        # Ensemble: 65% model + 35% heuristics
        if heuristic.get("available", False):
            combined = model_prob * 0.65 + heur_prob * 0.35
        else:
            combined = model_prob

        # ── Audio-Visual Mismatch Boost ───────────────────────────────
        # Key insight: in face-swap deepfakes, the FACE is fake but the
        # VOICE is real (dubbed from original footage). This mismatch
        # is itself a strong deepfake signal.
        # If visual says FAKE (high prob) but audio says HUMAN → mismatch
        av_mismatch = False
        av_mismatch_score = 0.0
        if visual_fake_prob >= 0.45 and model_prob < 0.55:
            # Visual shows manipulation signs, audio sounds human → face-swap
            av_mismatch = True
            av_mismatch_score = visual_fake_prob * 0.6
            combined = max(combined, av_mismatch_score)
            logger.info(
                f"Audio-visual mismatch detected: visual_fake={visual_fake_prob:.2f} "
                f"audio_fake={model_prob:.2f} → boosted to {combined:.2f}"
            )

        combined   = float(np.clip(combined, 0.0, 1.0))
        is_fake    = combined >= self.FAKE_THRESHOLD
        confidence = round(combined * 100, 1)

        details = self._build_details(
            combined, is_fake, features, model_prob, heur_prob, av_mismatch
        )

        result_label = "AI_VOICE" if is_fake else "HUMAN_VOICE"
        if av_mismatch:
            result_label = "AV_MISMATCH"  # special label for face-swap case

        return {
            "available":        True,
            "result":           result_label,
            "confidence":       confidence,
            "fake_probability": round(combined, 4),
            "model_score":      round(model_prob * 100, 1),
            "heuristic_score":  round(heur_prob * 100, 1),
            "av_mismatch":      av_mismatch,
            "details":          details,
            "features":         features,
        }

    def _build_details(
        self,
        prob: float,
        is_fake: bool,
        features: dict,
        model_prob: float,
        heur_prob: float,
        av_mismatch: bool = False,
    ) -> list[str]:
        details = []

        # Audio-visual mismatch is the most important signal
        if av_mismatch:
            details.append(
                "⚠️ Audio-visual mismatch detected — face appears manipulated but voice is human. "
                "This is the hallmark of face-swap deepfakes where original audio is preserved."
            )
            details.append(
                "Voice is authentic human speech, but does NOT match the manipulated face — "
                "consistent with dubbed deepfake video (e.g. movie scene re-faced)"
            )
            details.append(
                f"Visual deepfake confidence was high while voice model scored {(1-model_prob)*100:.1f}% human — "
                "strong indicator of face-swap rather than full synthesis"
            )
            return details

        if is_fake:
            if prob > 0.85:
                details.append("High-confidence AI-generated voice detected")
            elif prob > 0.70:
                details.append("Strong synthetic voice characteristics identified")
            else:
                details.append("AI voice patterns detected — likely TTS or voice cloning")

            pitch_std = features.get("pitch_std_hz")
            if pitch_std is not None and pitch_std < 15:
                details.append(
                    f"Unnaturally stable pitch (σ={pitch_std}Hz) — "
                    "human speech typically varies 20-80Hz"
                )

            delta_var = features.get("mfcc_delta_var")
            if delta_var is not None and delta_var < 1.5:
                details.append(
                    "Insufficient micro-variation in articulation — "
                    "characteristic of TTS synthesis"
                )

            silence = features.get("silence_ratio")
            if silence is not None and silence < 0.05:
                details.append(
                    "No natural breath pauses detected — "
                    "AI voices lack organic speech rhythm"
                )

            details.append(f"ASVspoof model confidence: {model_prob*100:.1f}% synthetic")
        else:
            if prob < 0.25:
                details.append("Strong indicators of authentic human voice")
            else:
                details.append("Voice characteristics consistent with natural human speech")

            pitch_std = features.get("pitch_std_hz")
            if pitch_std is not None and pitch_std >= 20:
                details.append(f"Natural pitch variation detected (σ={pitch_std}Hz)")

            silence = features.get("silence_ratio")
            if silence is not None and 0.05 <= silence <= 0.35:
                details.append(
                    "Natural speech rhythm with organic pauses and breath sounds"
                )

            details.append(f"ASVspoof model confidence: {(1-model_prob)*100:.1f}% human")

        return details


# ─────────────────────────────────────────────
# Orchestrator
# ─────────────────────────────────────────────
class AudioAuthenticator:
    def __init__(self):
        self.extractor = AudioExtractorAgent()
        self.analyzer  = AudioAnalysisAgent()
        self.decision  = AudioDecisionAgent()
        self.reporter  = AudioReportAgent()

    def analyze(self, video_path: str, visual_fake_prob: float = 0.5) -> dict:
        # Step 1: Extract audio
        waveform, sr = self.extractor.extract(video_path)

        if waveform is None or len(waveform) == 0:
            return self.reporter.generate(0.5, {}, has_audio=False)

        # Step 2: Heuristic analysis
        heuristic = self.analyzer.analyze(waveform, sr)

        # Step 3: Model prediction
        model_prob = self.decision.predict(waveform, sr)

        # Step 4: Report (pass visual prob for mismatch detection)
        return self.reporter.generate(
            model_prob, heuristic, has_audio=True,
            visual_fake_prob=visual_fake_prob,
        )
