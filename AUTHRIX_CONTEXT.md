# AUTHRIX — Complete Project Context

> Give this file to any AI to get full context about the Authrix deepfake detection project.

---

## 1. What Is Authrix?

Authrix is a full-stack AI-powered deepfake detection platform. It analyzes videos and determines whether they are REAL (authentic) or FAKE (AI-generated/manipulated). It uses a multi-agent pipeline combining visual analysis, audio analysis, and metadata scanning.

**Live URL:** https://aarav13-authrix.hf.space  
**GitHub:** https://github.com/Aarav-bit/Authrix  
**HuggingFace Space:** https://huggingface.co/spaces/Aarav13/AuthriX  
**Owner:** Aarav (Aarav13 on HuggingFace, Aarav-bit on GitHub)

---

## 2. Project Structure

```
E:\DeepFake Detect\
├── backend/                    ← FastAPI Python backend (the core)
│   ├── main.py                 ← App entry, routes, middleware, file serving
│   ├── detector.py             ← Core detection engine (all agents)
│   ├── audio_detector.py       ← Audio analysis pipeline
│   ├── auth.py                 ← API key system, tier limits
│   ├── requirements.txt        ← Python dependencies
│   └── uploads/                ← Temp video storage (auto-cleaned)
│
├── extension/                  ← Chrome/Edge browser extension (MV3)
│   ├── manifest.json           ← Extension config, permissions
│   ├── background.js           ← Service worker, tab capture, API calls
│   ├── content.js              ← Overlay UI injected into pages
│   ├── offscreen.js            ← MediaRecorder (MV3 requirement)
│   ├── offscreen.html          ← Offscreen document host
│   ├── popup.html/js           ← Extension popup UI
│   └── overlay.css             ← Overlay styles
│
├── frontend-vanilla/           ← The ACTIVE website (served by FastAPI)
│   ├── index.html              ← Main app (cyberpunk dashboard UI)
│   ├── pricing.html            ← Pricing/business page
│   └── script.js               ← Frontend JS logic
│
├── Dockerfile                  ← Docker build for HuggingFace Spaces
├── README.md                   ← Full project documentation
├── BUSINESS_MODEL.md           ← Revenue strategy and pricing
└── .gitignore
```

**Note:** `frontend/` (React) exists locally but is NOT deployed — `frontend-vanilla/` is what's live.

---

## 3. Backend — Detection Pipeline

### File: `backend/detector.py`

The core engine. Uses a multi-agent architecture:

#### Agent 0: MetadataAgent
- Scans first 512KB + last 64KB of video file
- Looks for C2PA Content Credentials (cryptographic AI signatures)
- Detects AI tool names: Veo3, Sora, Runway, Pika, Kling, Stability AI, Firefly, etc.
- **Hard override**: if C2PA found → FAKE regardless of visual model
- Adds ~50ms, no ML required

#### Agent 1: FrameAnalyzerAgent
- Extracts 40 frames (20 in fast_mode) uniformly across video duration
- Resizes to 640×480 for processing
- `fast_mode=True` for short captures (<30s), `fast_mode=False` for uploads

#### Agent 2: FaceDetectorAgent
- Uses MediaPipe face detection (confidence threshold: 0.3)
- Single context for ALL frames (avoids repeated model init — 3× faster)
- Crops faces with 20% padding, resizes to 224×224
- Falls back to full-frame analysis if <5 faces detected

#### Agent 3: DecisionAgent (ViT Ensemble)
- **Model 1:** `dima806/deepfake_vs_real_image_detection` (99.3% accuracy, fake_label="Fake")
- **Model 2:** `prithivMLmods/Deep-Fake-Detector-v2-Model` (92.1% accuracy, fake_label="Deepfake")
- Per-crop inference (float32 — float16 breaks CPU inference)
- Early exit: if Model 1 score > 0.88 or < 0.12, skip Model 2
- Ensemble: Model1 × 0.55 + Model2 × 0.45
- Falls back to heuristic analysis if models unavailable

#### Agent 4: ReportGeneratorAgent
- Base threshold: 0.58 (adaptive: ±0.03–0.07 based on consistency/coverage)
- C2PA hard override: always FAKE if metadata signals found
- Audio-visual mismatch detection (face-swap signal)
- Confidence calibration: maps raw probability to 88–99% display range
- `_calibrate()`: `distance = abs(prob - 0.5)`, `conf = 0.88 + 0.11 * (distance/0.5)^0.6`

#### Orchestrator: DeepfakeAuthenticator
```
analyze(video_path, fast_mode=False):
  1. Cache check (SHA256 hash of first 1MB + file size)
  2. MetadataAgent.analyze() — instant C2PA scan
  3. FrameAnalyzerAgent.extract_frames()
  4. [PARALLEL] FaceDetectorAgent + AudioAuthenticator (20s timeout)
  5. DecisionAgent.analyze_frames()
  6. ReportGeneratorAgent.generate()
  7. Cache result
```

### File: `backend/audio_detector.py`

Four-agent audio pipeline:
- **AudioExtractorAgent**: extracts first 30s of audio via moviepy, converts to 16kHz mono WAV
- **AudioAnalysisAgent**: librosa heuristics (pitch variance, MFCC delta, spectral flatness, ZCR, silence ratio)
- **AudioDecisionAgent**: Wav2Vec2 model (`Vansh180/deepfake-audio-wav2vec2`), max 3 chunks (30s)
- **AudioReportAgent**: combines model + heuristics, detects AV_MISMATCH (face-swap signal)

Audio results: `HUMAN_VOICE`, `AI_VOICE`, `AV_MISMATCH`, `NO_AUDIO`

### File: `backend/main.py`

FastAPI app with these routes:
- `GET /health` → server status + model info
- `POST /analyze` → upload video file, returns detection result
- `POST /analyze-url` → analyze video from URL (uses yt-dlp for YouTube/TikTok/etc.)
- `GET /` → serves `frontend-vanilla/index.html`
- `GET /pricing` → serves `frontend-vanilla/pricing.html`
- `GET /script.js` → serves `frontend-vanilla/script.js`
- `GET /{filename}` → catch-all for static files

**Key logic in `/analyze`:**
- Validates file extension (mp4, avi, mov, mkv, webm, wmv)
- Max file size: 100MB
- Converts webm/mkv to mp4 via bundled ffmpeg (imageio-ffmpeg) — OpenCV can't decode webm on Windows
- Auto-detects fast_mode: videos <30s use 20 frames, ≥30s use 40 frames
- 120s request timeout

### File: `backend/auth.py`

API key system:
- Keys stored in `backend/api_keys.json`
- Tiers: free (10/mo), pro (100/mo), business (1000/mo), enterprise/owner (unlimited)
- `validate_api_key()`, `check_usage_limit()`, `increment_usage()`
- Owner key: `authrix_vx5b5HqXIEtAuhUJw92p-aU7Ucz34RtWHzpBCzbKqKE` (unlimited)

---

## 4. API Response Format

```json
{
  "result": "FAKE",           // "FAKE" or "REAL"
  "confidence": 94.2,         // 88-99% (calibrated display score)
  "details": [                // Human-readable explanation bullets
    "Strong deepfake indicators detected across multiple facial regions",
    "Inconsistent manipulation across frames (78% flagged)",
    "Unnatural texture blending detected at facial boundary regions"
  ],
  "frame_timeline": [         // Per-frame fake probability
    {"frame": 0, "fake_pct": 82.1},
    {"frame": 5, "fake_pct": 79.3}
  ],
  "metadata": {
    "frames_analyzed": 38,
    "frames_with_faces": 35,
    "video_duration_sec": 12.4,
    "video_fps": 30.0,
    "resolution": "1280x720"
  },
  "audio": {
    "available": true,
    "result": "HUMAN_VOICE",  // HUMAN_VOICE | AI_VOICE | AV_MISMATCH | NO_AUDIO
    "confidence": 91.2,
    "fake_probability": 0.12
  },
  "metadata_check": {
    "ai_generated": false,
    "c2pa_detected": false,
    "tool_detected": null
  },
  "processing_time_sec": 18.4,
  "cached": false             // true if returned from cache
}
```

---

## 5. Browser Extension

**Version:** 2.2.0 (Manifest V3)  
**Supported:** Chrome, Edge, Brave

### Architecture (MV3 compliant)
```
User clicks popup
  → popup.js sends START_CAPTURE to background.js
  → background.js calls tabCapture.getMediaStreamId()
  → background.js creates offscreen document
  → offscreen.js gets getUserMedia({chromeMediaSource:'tab'})
  → offscreen.js records 8 seconds via MediaRecorder (4Mbps)
  → offscreen.js sends raw byte chunks to background.js
  → background.js reassembles bytes → Blob → FormData
  → background.js POSTs to /analyze
  → background.js sends result to content.js
  → content.js renders overlay on the page
```

### Key Files
- `background.js`: Service worker. Handles tab capture, API calls, offscreen management. `API_BASE` points to HF Space.
- `offscreen.js`: Records tab stream. Sends raw Uint8Array chunks (not base64 — avoids message size limits).
- `content.js`: Renders overlay UI. Shows loading steps, result (FAKE/REAL), confidence bar, audio row, metadata.
- `popup.html/js`: Extension popup. Shows server status, current page info, capture button, URL input, last result.
- `manifest.json`: Permissions: `tabCapture`, `scripting`, `storage`, `offscreen`, `contextMenus`, `tabs`, `activeTab`.

### API Base URLs
- **Local dev:** `http://localhost:8000`
- **Production (HF):** `https://aarav13-authrix.hf.space`

### Context Menu
- Right-click page → "🔍 Analyze with Authrix" (captures tab stream)
- Right-click link → "🔗 Analyze video URL with Authrix" (sends URL to /analyze-url)

---

## 6. Frontend (frontend-vanilla/)

Vanilla HTML/CSS/JS — no framework. Served directly by FastAPI.

### `index.html`
- Cyberpunk-themed dashboard
- Tailwind CSS (CDN), Space Grotesk font
- Navigation: Dashboard | Pricing | Agents | Logs | Network
- Upload zone with drag-and-drop
- Analysis progress UI with step indicators
- Results panel with confidence score, frame timeline, details
- Modals: Agents, Logs, Network

### `pricing.html`
- Pricing tiers: Free ($0), Pro ($9.99/mo), Business ($49/mo), Enterprise (custom)
- FAQ section
- "DEMO VERSION" badge removed — looks production-ready
- Buttons show alert explaining payment integration coming soon

---

## 7. Deployment

### HuggingFace Spaces (Live)
- **URL:** https://aarav13-authrix.hf.space
- **Space:** https://huggingface.co/spaces/Aarav13/AuthriX
- **Runtime:** Docker (port 7860)
- **Dockerfile:** Installs system deps, copies backend + frontend-vanilla, installs Python deps, pre-caches HF models at build time
- **User:** runs as user 1000 (HF requirement)
- Models are baked into the Docker image — no cold-start download

### Git Remotes
```
origin  → https://github.com/Aarav-bit/Authrix.git
hf      → https://huggingface.co/spaces/Aarav13/AuthriX
```

### Deploy Commands
```bash
# Push to GitHub
git push origin master

# Push to HuggingFace (triggers rebuild)
git push hf master:main

# Force push (after history rewrite)
git push hf master:main --force
```

### Local Dev
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
# App at http://localhost:8000
```

---

## 8. Python Dependencies (requirements.txt)

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-multipart==0.0.9
opencv-python-headless==4.9.0.80   # headless for server
mediapipe==0.10.14
numpy==1.26.4
Pillow==10.3.0
transformers>=4.41.0
torch>=2.3.0
torchvision
torchaudio
moviepy>=1.0.3
librosa>=0.10.0
soundfile>=0.12.1
imageio-ffmpeg>=0.4.9              # bundled ffmpeg binary
yt-dlp>=2024.1.0
httpx>=0.27.0
stripe>=8.0.0
```

---

## 9. Known Issues & Decisions

| Issue | Decision |
|---|---|
| OpenCV can't decode .webm on Windows | Convert to .mp4 via bundled ffmpeg (imageio-ffmpeg) before analysis |
| Float16 on CPU produces wrong results | Always use float32 for ViT inference |
| Batching all 40 crops causes OOM on HF CPU | Per-crop inference with early exit |
| Audio Wav2Vec2 hangs on long videos | 20s timeout + cap to 3 chunks (30s of audio) |
| Modern AI video (Veo3, Sora) fools ViT models | C2PA metadata scan as hard override |
| Extension base64 encoding corrupts large videos | Send raw Uint8Array chunks instead |
| HF rejects PNG files in git push | Force-add icons with `git add -f`, exclude others via .gitignore |
| Temporal consistency agent caused false positives | Removed — thresholds too aggressive for real phone videos |

---

## 10. Business Model

### Tiers
| Tier | Price | Analyses/Month |
|---|---|---|
| Free | $0 | 10 |
| Pro | $9.99/mo | 100 |
| Business | $49/mo | 1,000 |
| Enterprise | Custom | Unlimited |

### Revenue Streams
1. SaaS subscriptions (main)
2. Pay-per-use API ($0.05–$0.25 per video)
3. Browser extension premium ($4.99/mo)
4. B2B enterprise deals ($5K–$50K/mo)
5. White-label licensing
6. Consulting & custom model training

### Payment
- Stripe integration code exists (`backend/stripe_integration.py`) but NOT connected
- Currently demo-only — buttons show alert
- Owner API key has unlimited access

---

## 11. Accuracy Notes

- **Works well on:** Face-swap deepfakes, GAN-generated faces, AI voice synthesis, C2PA-signed AI video (Veo3, Sora, Runway)
- **Limitations:** Modern diffusion-based video (Veo3 without C2PA) can fool the ViT models — they were trained on older GAN-based fakes
- **Threshold:** 0.58 base (adaptive ±0.03–0.07). Raising reduces false positives on real videos. Lowering catches more deepfakes but increases false positives.
- **Confidence display:** Always 88–99% (calibrated). Raw model scores of 0.60 → ~92% displayed.

---

## 12. Extension Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked** → select `extension/` folder
4. Authrix icon appears in toolbar
5. Make sure backend is running at `http://localhost:8000` (local) or HF Space is live

---

## 13. Quick Reference — Key Variables

| Variable | Location | Value |
|---|---|---|
| `API_BASE` | extension/background.js | `https://aarav13-authrix.hf.space` |
| `API_BASE` | extension/popup.js | `https://aarav13-authrix.hf.space` |
| `CAPTURE_SEC` | extension/background.js | `8` (seconds to record) |
| `BASE_THRESHOLD` | backend/detector.py | `0.58` |
| `MAX_FILE_SIZE_MB` | backend/main.py | `100` |
| `UPLOAD_DIR` | backend/main.py | `uploads/` |
| Owner API Key | backend/api_keys.json | `authrix_vx5b5HqXIEtAuhUJw92p-aU7Ucz34RtWHzpBCzbKqKE` |
| HF Port | Dockerfile | `7860` |
| Local Port | main.py | `8000` |

---

## 14. How to Make Changes

### Change detection threshold (more/less sensitive)
Edit `backend/detector.py` → `ReportGeneratorAgent.BASE_THRESHOLD`
- Higher (e.g. 0.65) = fewer false positives, may miss subtle fakes
- Lower (e.g. 0.52) = catches more fakes, more false positives on real videos

### Change capture duration
Edit `extension/background.js` → `CAPTURE_SEC`

### Switch extension between local and production
Edit `extension/background.js` and `extension/popup.js` → `API_BASE`

### Add a new AI generator signature
Edit `backend/detector.py` → `MetadataAgent.AI_SIGNATURES` and `AI_TOOL_NAMES`

### Deploy after changes
```bash
git add -A
git commit -m "your message"
git push origin master        # GitHub
git push hf master:main       # HuggingFace (triggers rebuild)
```
