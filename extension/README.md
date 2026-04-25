# Authrix Browser Extension

Detect deepfake videos on any webpage without downloading them.

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. The Authrix icon appears in your toolbar

## Requirements

The Authrix backend must be running locally:
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Usage

### Method 1 — Right-click any video
Right-click on a video element on any webpage → **"🔍 Analyze with Authrix"**

### Method 2 — Toolbar popup
Click the Authrix icon in the toolbar:
- Auto-detects videos on the current page
- Paste any direct video URL manually
- Shows last analysis result

### Method 3 — Right-click a link
Right-click any link to a video file → **"🔍 Analyze video URL with Authrix"**

## How it works

1. Extension captures the video URL from the page
2. Background service worker fetches the video and sends it to `localhost:8000/analyze`
3. FastAPI backend runs the full 5-agent pipeline (visual + audio)
4. Result overlay appears on the page with verdict, confidence, and insights

## Limitations

- **DRM-protected videos** (Netflix, Disney+) cannot be analyzed
- **YouTube** — the extension detects the page URL but YouTube's video streams require yt-dlp; direct URL analysis works for non-DRM videos
- Backend must be running on `localhost:8000`
- Large videos (>100MB) may time out
