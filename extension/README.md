# Authrix Browser Extension

Detect deepfake videos on any webpage — no download required.

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
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

### Method 1 — Toolbar popup (recommended)
Click the Authrix icon → **Capture & Analyze Video**

Records 12 seconds of the currently playing video, sends it to the local AI, and shows the verdict as an overlay on the page.

### Method 2 — Paste a URL
Click the Authrix icon → paste a direct video URL → **Analyze**

Works with direct `.mp4` / `.webm` links. For YouTube, Twitter, TikTok etc., `yt-dlp` must be installed on the backend (`pip install yt-dlp`).

### Method 3 — Right-click menu
- Right-click anywhere on a page → **🔍 Analyze with Authrix** (captures tab stream)
- Right-click a video link → **🔗 Analyze video URL with Authrix**

## Architecture (MV3)

```
popup.js
  └─ sends START_CAPTURE / ANALYZE_URL → background.js

background.js
  ├─ tabCapture.getMediaStreamId()     (stream ID for the tab)
  ├─ creates offscreen document
  └─ sends RECORD_OFFSCREEN → offscreen.js

offscreen.js
  ├─ getUserMedia({ chromeMediaSource: 'tab' })
  ├─ MediaRecorder records for 12s
  └─ sends BLOB_READY → background.js

background.js
  ├─ POST /analyze (blob) or POST /analyze-url (URL)
  └─ sends ANALYSIS_RESULT → content.js

content.js
  └─ renders overlay with verdict, confidence, details
```

## Limitations

- **DRM-protected content** (Netflix, Disney+, Prime) cannot be captured
- **YouTube** tab capture works; URL analysis requires `yt-dlp` on the backend
- Backend must be running on `localhost:8000`
- Videos > 100 MB may time out
