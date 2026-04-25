<div align="center">

# 🔍 AUTHRIX
### AI-Powered Deepfake Detection Engine

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![HuggingFace](https://img.shields.io/badge/🤗_HuggingFace-ViT_Ensemble-FFD21E?style=for-the-badge)](https://huggingface.co)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Authrix** is a full-stack, multi-agent deepfake detection platform that analyzes videos for AI-generated content using a Vision Transformer (ViT) ensemble, temporal consistency analysis, C2PA metadata scanning, and AI audio detection — all wrapped in a sleek cyberpunk-themed dashboard and a Chrome extension.

[🚀 Live Demo](https://aarav13-authrix.hf.space) · [🧩 Chrome Extension](#browser-extension) · [📡 API Reference](#api-reference) · [💬 Pricing](#pricing--tiers)

</div>

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **ViT Ensemble** | 2-model Vision Transformer ensemble (dima806 + prithivMLmods) with float16 batched inference |
| 🎞️ **Temporal Analysis** | Detects AI video patterns: unnatural motion smoothness, temporal flickering, color drift |
| 🔏 **C2PA / Metadata Scan** | Identifies AI generator signatures from Veo3, Sora, Runway, Firefly, Kling, etc. |
| 🔊 **Audio Detection** | Spectral analysis for AI voice synthesis & audio-visual mismatch detection |
| 🌐 **Browser Extension** | Chrome/Edge extension (MV3) that captures tab video stream for real-time analysis |
| 🔗 **URL Analysis** | Paste any YouTube/TikTok/Twitter/Instagram URL — powered by yt-dlp |
| 🔑 **API Key System** | Tiered access control with per-month usage quotas and Stripe billing integration |
| 🐳 **Docker + Render** | One-command deployment to Render (or any Docker host / HuggingFace Spaces) |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  React Frontend │  │ Chrome Extension │  │  REST API  │  │
│  │  (Vite + TW4)  │  │    (MV3, JS)     │  │  Consumers │  │
│  └────────┬────────┘  └────────┬─────────┘  └─────┬──────┘  │
└───────────┼─────────────────── ┼─────────────────── ┼────────┘
            │                    │                     │
            ▼                    ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│                      FastAPI BACKEND                         │
│                                                              │
│  POST /analyze      POST /analyze-url      GET /health       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  DETECTION PIPELINE                    │  │
│  │                                                        │  │
│  │  Agent 0a: Metadata Agent  (C2PA / AI tool scan)       │  │
│  │  Agent 0b: Temporal Agent  (flicker / motion CV)       │  │
│  │  Agent 1:  Frame Extractor (dedup, 40-frame sample)    │  │
│  │  Agent 2:  Face Detector   (MediaPipe, single ctx)     │  │
│  │  Agent 3:  Decision Agent  (ViT ensemble, float16)     │  │
│  │  Agent 4:  Report Agent    (calibrated + audio fused)  │  │
│  │  Agent 5:  Audio Agent     (librosa spectral + AV sync)│  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Detection Pipeline

1. **Metadata Agent** — Binary-scans the first 512 KB + last 64 KB of the video file for C2PA markers, XMP tags, and known AI-generator signatures (Veo, Sora, Runway, Kling, Firefly…). If a C2PA block is found, the file is immediately flagged with 98% confidence.

2. **Temporal Agent** — Measures pixel-level temporal variance, frame-difference coefficient of variation, high-frequency noise consistency, and color-channel drift across frames. Catches modern AI video generators that produce unnaturally smooth motion.

3. **Frame Extractor** — Intelligently samples up to 40 deduplicated frames, skipping near-identical consecutive frames to save inference time.

4. **Face Detector** — MediaPipe face detection runs in a **single context** across all frames (avoids repeated model init) and crops each face with 20% padding.

5. **Decision Agent (ViT Ensemble)** — All face crops are sent to **both ViT models in a single batched forward pass** (float16). Model 2 is early-exited if Model 1 is already very confident (>88% or <12%). Scores are ensemble-weighted 55/45.

6. **Audio Agent** — Extracts audio track via MoviePy/ffmpeg, runs librosa spectral analysis to detect AI voice synthesis, unnatural pitch/tempo regularity, and audio-visual sync mismatches.

7. **Report Agent** — Fuses all signals with an adaptive threshold. A C2PA hard match always wins; audio-visual mismatch overrides visual; otherwise, temporal + visual ensemble determines the final verdict with calibrated confidence.

---

## 🗂️ Project Structure

```
authrix/
├── backend/                    # FastAPI backend
│   ├── main.py                 # App entry point, routes, middleware
│   ├── detector.py             # Core multi-agent detection engine (all 5 agents)
│   ├── audio_detector.py       # Audio analysis agent (librosa + AV sync)
│   ├── auth.py                 # API key validation, tier limits
│   ├── stripe_integration.py   # Stripe billing hooks
│   ├── create_owner_key.py     # CLI helper to mint API keys
│   ├── test_temporal.py        # Unit tests for temporal analysis
│   ├── requirements.txt        # Python dependencies
│   └── uploads/                # Temp upload directory (auto-cleaned)
│
├── frontend/                   # React 19 + Vite 8 + Tailwind 4 dashboard
│   ├── src/
│   │   ├── components/         # UI components (Loader, ResultCard, etc.)
│   │   └── main.jsx            # App entry
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── frontend-vanilla/           # Vanilla HTML/JS fallback frontend
│   ├── index.html
│   ├── pricing.html
│   └── script.js               # ~15KB — full upload + results UI
│
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── manifest.json           # Permissions, MV3 config
│   ├── background.js           # Service worker (tab capture)
│   ├── content.js              # Content script (overlay injection)
│   ├── offscreen.js            # Offscreen document for MediaRecorder
│   ├── popup.html / popup.js   # Extension popup UI
│   ├── overlay.css             # Injected overlay styles
│   └── icons/                  # Extension icons (16/48/128px)
│
├── Dockerfile                  # Multi-stage Docker build
├── render.yaml                 # Render.com deployment config
├── setup.sh / setup.bat        # One-command environment setup
├── start.sh / start.bat        # Dev server launcher
└── BUSINESS_MODEL.md           # Monetization guide & pricing
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend build |
| npm / pnpm | Latest | JS package manager |
| ffmpeg | Any | Video conversion (auto-bundled via imageio-ffmpeg) |
| Docker | 24+ | Containerized deployment (optional) |

> **Windows users:** ffmpeg is bundled via `imageio-ffmpeg` — no manual install required.

---

### Option A — Quick Start (Local Dev)

#### 1. Clone the Repository

```bash
git clone https://github.com/Aarav-bit/Authrix.git
cd Authrix
```

#### 2. Backend Setup

```bash
cd backend
python -m venv ../venv

# Activate (Linux/macOS)
source ../venv/bin/activate

# Activate (Windows)
..\venv\Scripts\activate

pip install -r requirements.txt
```

> **Note:** First startup downloads ~2 GB of ViT model weights from HuggingFace. Subsequent starts use the local cache.

#### 3. Start the Backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be live at **http://localhost:8000** and the vanilla frontend will be served automatically.

#### 4. (Optional) Start the React Frontend

```bash
cd ../frontend
npm install
npm run dev
```

React dashboard available at **http://localhost:5173**.

---

### Option B — One-Command Setup Scripts

```bash
# Linux / macOS
./setup.sh
./start.sh

# Windows
setup.bat
start.bat
```

---

### Option C — Docker

```bash
# Build image
docker build -t authrix .

# Run
docker run -p 7860:7860 authrix
```

Open **http://localhost:7860**.

---

## 🌐 Deployment

### Render (Recommended)

1. Fork this repository.
2. Create a new **Web Service** on [Render](https://render.com).
3. Connect your GitHub repo — Render auto-detects `render.yaml`.
4. Set env vars (see below).
5. Deploy. ✅

`render.yaml` configures:
- Runtime: Docker
- Health check: `GET /health`
- Port: `8000`

### HuggingFace Spaces

The `Dockerfile` is pre-configured for HuggingFace Spaces (port 7860, user 1000) and pre-caches both ViT models at build time.

1. Create a new Space → **Docker** runtime.
2. Push this repo as the Space source.
3. Models are cached in the image — cold start is instant.

### Manual VPS

```bash
# Pull latest
git pull origin main

# Build frontend
cd frontend && npm run build
cp -r dist ../frontend-dist

# Install Python deps
cd ../backend
pip install -r requirements.txt

# Start with Gunicorn (production)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

---

## ⚙️ Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | No | Port to bind | `8000` |
| `PYTHONUNBUFFERED` | No | Force stdout flush | `1` |
| `STRIPE_SECRET_KEY` | Optional | Stripe billing | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhooks | `whsec_...` |

> API keys for end-users are stored in `backend/api_keys.json` (auto-generated). No external database required.

---

## 🔑 API Reference

### Base URL
```
https://aarav13-authrix.hf.space   (production)
http://localhost:8000               (local)
```

### Authentication

Pass your API key as a header. For local development, the key is optional.

```
X-API-Key: authrix_YOUR_KEY_HERE
```

---

### `GET /health`

Check server readiness.

```bash
curl https://aarav13-authrix.hf.space/health
```

**Response:**
```json
{
  "status": "ok",
  "model": "Ensemble (2 ViT models)",
  "ready": true
}
```

---

### `POST /analyze`

Analyze an uploaded video file for deepfake content.

```bash
curl -X POST http://localhost:8000/analyze \
  -H "X-API-Key: authrix_YOUR_KEY" \
  -F "file=@/path/to/video.mp4"
```

**Supported formats:** `.mp4`, `.avi`, `.mov`, `.mkv`, `.webm`, `.wmv`  
**Max file size:** 100 MB

**Response:**
```json
{
  "result": "FAKE",
  "confidence": 87.3,
  "details": {
    "visual_score": 0.82,
    "audio_result": "AI_VOICE",
    "temporal_signals": ["Perfectly uniform motion (CV=0.01)"],
    "metadata_signals": ["c2pa", "tool:runway"],
    "face_coverage": 0.92,
    "frames_analyzed": 38
  },
  "frame_timeline": [
    { "frame_index": 0, "fake_probability": 0.84 },
    { "frame_index": 5, "fake_probability": 0.79 }
  ],
  "metadata": {
    "frames_analyzed": 38,
    "frames_with_faces": 35,
    "video_duration_sec": 12.4,
    "video_fps": 30.0,
    "resolution": "1280x720"
  }
}
```

---

### `POST /analyze-url`

Analyze a video from a URL (YouTube, TikTok, Twitter, Instagram, etc.).

```bash
curl -X POST http://localhost:8000/analyze-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=..."}'
```

**Response:** Same structure as `/analyze`.

---

### Error Codes

| Status | Meaning |
|---|---|
| `400` | Bad request (unsupported format, invalid URL) |
| `401` | Invalid or missing API key |
| `413` | File too large (>100 MB) |
| `429` | Monthly usage limit exceeded |
| `503` | Server still initializing — retry in 30s |

---

## 💰 Pricing & Tiers

| Tier | Price | Analyses / Month | Features |
|---|---|---|---|
| **Free** | $0 | 10 | Extension, 2-min videos, community support |
| **Pro** | $9.99/mo | 100 | 10-min videos, API access (100 calls), email support |
| **Business** | $49/mo | 1,000 | Unlimited length, API (5K calls), white-label reports |
| **Enterprise** | Custom | Unlimited | On-premise, custom training, SLA, dedicated support |

### Pay-Per-Use API

| Video Length | Price |
|---|---|
| < 5 min | $0.05 |
| 5–15 min | $0.10 |
| > 15 min | $0.25 |

### Generate an API Key (Self-Hosted)

```bash
cd backend
python create_owner_key.py
# Or:
python -c "from auth import create_api_key; print(create_api_key('you@email.com', 'pro'))"
```

---

## 🧩 Browser Extension

The Authrix Chrome Extension (v2.2.0, Manifest V3) allows one-click deepfake analysis of any video playing in your browser tab.

### How It Works

1. User clicks the Authrix toolbar icon while a video is playing.
2. The background service worker uses the `tabCapture` API to start recording the tab's media stream.
3. An offscreen document captures ~8 seconds of video via `MediaRecorder`.
4. The clip is posted to the Authrix API and the result is overlaid on the page.

### Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. The Authrix icon appears in your toolbar

### Permissions

| Permission | Reason |
|---|---|
| `tabCapture` | Record tab video stream |
| `scripting` | Inject result overlay |
| `storage` | Cache API key & usage |
| `offscreen` | Run MediaRecorder out-of-context |
| `contextMenus` | Right-click menu |

---

## 🛠️ Development

### Backend

```bash
# Run with hot-reload
uvicorn main:app --reload --port 8000

# Run tests
cd backend
python test_temporal.py

# Lint
flake8 . --max-line-length=120
```

### Frontend (React)

```bash
cd frontend
npm run dev      # Dev server with HMR
npm run build    # Production build → dist/
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Available Scripts Summary

| Command | Description |
|---|---|
| `uvicorn main:app --reload` | Backend dev server |
| `npm run dev` | React frontend dev server |
| `npm run build` | Build React app for production |
| `python create_owner_key.py` | Generate a new API key |
| `docker build -t authrix .` | Build Docker image |

---

## 🔬 Tech Stack

### Backend
- **FastAPI 0.111** — Async REST API with automatic OpenAPI docs
- **Python 3.11** — Core runtime
- **OpenCV 4.9** — Video decoding and frame extraction
- **MediaPipe 0.10** — Face detection (single-context optimized)
- **HuggingFace Transformers** — ViT model loading and inference
- **PyTorch 2.3+** — Float16 batched tensor inference
- **librosa 0.10** — Audio feature extraction and spectral analysis
- **imageio-ffmpeg** — Bundled ffmpeg binary for video conversion
- **yt-dlp** — URL-based video download (YouTube, TikTok, etc.)
- **Stripe** — Payment processing and subscription management

### Frontend
- **React 19** — UI library
- **Vite 8** — Build tool and dev server
- **Tailwind CSS 4** — Utility-first styling
- **Three.js + @react-three/fiber** — 3D particle effects
- **Framer Motion** — Animations
- **Zustand** — Lightweight state management

### Infrastructure
- **Docker** — Containerization
- **Render** — PaaS deployment
- **HuggingFace Spaces** — Model hosting and demo deployment

### AI Models

| Model | Source | Purpose |
|---|---|---|
| `dima806/deepfake_vs_real_image_detection` | HuggingFace | Primary ViT classifier |
| `prithivMLmods/Deep-Fake-Detector-v2-Model` | HuggingFace | Secondary ViT classifier |

---

## 🔧 Troubleshooting

### Server takes a long time to start

**Cause:** HuggingFace models (~1–2 GB) are being downloaded on first run.  
**Fix:** Wait ~2–5 minutes. Subsequent starts use the local cache at `~/.cache/huggingface/`.

### `Could not open video` / OpenCV error on Windows

**Cause:** OpenCV on Windows cannot natively decode `.webm` or `.mkv`.  
**Fix:** The backend automatically converts these via bundled ffmpeg. Ensure `imageio-ffmpeg` is installed:
```bash
pip install imageio-ffmpeg
```

### Extension not sending data to the API

**Cause:** The extension is hard-coded to connect to `http://localhost:8000` (dev) or `https://aarav13-authrix.hf.space` (prod).  
**Fix:** Update `host_permissions` in `extension/manifest.json` to match your deployment URL, then reload the extension.

### `429 Monthly limit exceeded`

**Cause:** Your API key has hit its monthly quota.  
**Fix:** Upgrade your plan, or generate a new owner key locally:
```bash
python create_owner_key.py
```

### `503 Server still initializing`

**Cause:** The ViT models haven't finished loading yet.  
**Fix:** Hit `GET /health` and wait until `"ready": true`, then retry.

### Audio analysis not available

**Cause:** `librosa`, `soundfile`, or `moviepy` not installed, or the video has no audio track.  
**Fix:**
```bash
pip install librosa soundfile moviepy
```

---

## 🗺️ Roadmap

- [ ] Firefox extension support
- [ ] Real-time video stream analysis via WebSocket
- [ ] Mobile app (React Native)
- [ ] Batch analysis endpoint for enterprise workflows
- [ ] Webhook notifications for async analysis
- [ ] GDPR-compliant EU data residency option
- [ ] On-premise deployment Helm chart
- [ ] Fine-tuned model on latest Veo3 / Sora outputs

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feat/my-feature`
5. Open a Pull Request

Please make sure your code passes linting before submitting.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 📧 Contact

| Channel | Link |
|---|---|
| Enterprise Sales | enterprise@authrix.ai |
| Live Demo | https://aarav13-authrix.hf.space |
| API Docs | https://aarav13-authrix.hf.space/docs |

---

<div align="center">

**Built with ❤️ by the Authrix Team**

*Fighting misinformation, one frame at a time.*

</div>
