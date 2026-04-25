# 🎯 Deepfake Authenticator

An AI-powered web app that detects whether an uploaded video is real or deepfake.

## Features

- **Prediction** — REAL or FAKE verdict
- **Confidence Score** — 0–100% probability
- **Explainable Insights** — Human-readable analysis details
- **Frame Timeline** — Per-frame fake probability visualization
- **Agent Architecture** — Modular pipeline of 4 specialized agents

## Agent Pipeline

```
Video Upload
    │
    ▼
┌─────────────────────┐
│  Frame Analyzer     │  ← Extracts every 10th frame via OpenCV
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Face Detector      │  ← Detects & crops faces via MediaPipe
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Decision Agent     │  ← HuggingFace model OR heuristic fallback
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Report Generator   │  ← Builds verdict + explanation
└─────────────────────┘
    │
    ▼
JSON Response → Frontend
```

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Python, FastAPI, OpenCV, MediaPipe              |
| AI Model | HuggingFace `prithivMLmods/Deepfake-Detection-Model` (or heuristic fallback) |
| Frontend | HTML, TailwindCSS, Vanilla JS                   |

## Quick Start

### Windows
```bat
setup.bat
venv\Scripts\activate.bat
cd backend
python main.py
```

### macOS / Linux
```bash
chmod +x setup.sh && ./setup.sh
source venv/bin/activate
cd backend && python main.py
```

Then open **http://localhost:8000** in your browser.

## API

### `POST /analyze`

Upload a video file for analysis.

**Request:** `multipart/form-data` with `file` field

**Response:**
```json
{
  "result": "FAKE",
  "confidence": 78.4,
  "details": [
    "Significant facial manipulation artifacts identified",
    "Inconsistent manipulation across frames — typical of face-swap deepfakes",
    "Unnatural texture blending detected at facial boundaries",
    "High-frequency noise patterns inconsistent with natural video compression"
  ],
  "frame_timeline": [
    { "frame": 0, "fake_pct": 72.1 },
    { "frame": 1, "fake_pct": 81.3 }
  ],
  "metadata": {
    "frames_analyzed": 24,
    "frames_with_faces": 20,
    "video_duration_sec": 8.5,
    "video_fps": 30.0,
    "resolution": "1280x720"
  },
  "processing_time_sec": 4.2
}
```

### `GET /health`

Returns server status and active model type.

## Detection Logic

**Scoring:** Average fake probability across all detected faces and frames.
- `> 60%` → **FAKE**
- `≤ 60%` → **REAL**

**Heuristic fallback** (when HuggingFace model is unavailable) analyzes:
1. High-frequency noise patterns (Laplacian variance)
2. Color channel inconsistency
3. DCT frequency artifacts (GAN compression signatures)
4. Skin tone uniformity
5. Edge coherence anomalies

## Constraints

- Runs fully locally — no data sent to external servers
- Free/open-source models only
- Supports: MP4, AVI, MOV, MKV, WebM, WMV
- Max file size: 100 MB
- Target inference time: < 10 seconds for short videos
