/**
 * Authrix Extension — Background Service Worker
 * Handles context menu, coordinates analysis requests
 */

const API_BASE = 'http://localhost:8000';

// ── Create context menu on install ────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'authrix-analyze',
    title: '🔍 Analyze with Authrix',
    contexts: ['video', 'link', 'page'],
  });
  chrome.contextMenus.create({
    id: 'authrix-analyze-url',
    title: '🔍 Analyze video URL with Authrix',
    contexts: ['link'],
  });
  console.log('[Authrix] Extension installed, context menu created');
});

// ── Context menu click ────────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'authrix-analyze') {
    // Inject content script to find and analyze the video on the page
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: triggerPageAnalysis,
      args: [info.srcUrl || info.pageUrl || null],
    });
  }

  if (info.menuItemId === 'authrix-analyze-url') {
    const url = info.linkUrl || info.srcUrl;
    if (url) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showAuthrixOverlay,
        args: [url],
      });
    }
  }
});

// ── Message handler (from content script / popup) ─────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ANALYZE_URL') {
    analyzeVideoUrl(msg.url)
      .then(result => {
        chrome.storage.local.set({ lastResult: { ...result, file: msg.url.split('/').pop().slice(0,40) } });
        sendResponse({ ok: true, result });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'ANALYZE_YOUTUBE') {
    // Send YouTube URL directly to backend — backend handles yt-dlp download
    analyzeYouTubeUrl(msg.url)
      .then(result => {
        chrome.storage.local.set({ lastResult: { ...result, file: 'YouTube video' } });
        sendResponse({ ok: true, result });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'CHECK_HEALTH') {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(d => sendResponse({ ok: true, data: d }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'ANALYZE_FILE_BYTES') {
    analyzeBase64Video(msg.data, msg.filename, msg.mimeType)
      .then(result => {
        chrome.storage.local.set({ lastResult: { ...result, file: msg.filename } });
        sendResponse({ ok: true, result });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// ── Analyze a video by URL ────────────────────────────────────────────────────
async function analyzeVideoUrl(videoUrl) {
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);
  const blob = await response.blob();
  const filename = videoUrl.split('/').pop().split('?')[0] || 'video.mp4';
  return sendToBackend(blob, filename);
}

// ── Analyze YouTube URL via backend ──────────────────────────────────────────
async function analyzeYouTubeUrl(youtubeUrl) {
  const res = await fetch(`${API_BASE}/analyze-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: youtubeUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Backend error ${res.status}`);
  }
  return res.json();
}

// ── Analyze base64 video data ─────────────────────────────────────────────────
async function analyzeBase64Video(base64Data, filename, mimeType) {
  const byteString = atob(base64Data);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'video/mp4' });
  return sendToBackend(blob, filename || 'video.mp4');
}

// ── Send blob to FastAPI backend ──────────────────────────────────────────────
async function sendToBackend(blob, filename) {
  const fd = new FormData();
  fd.append('file', blob, filename);

  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Backend error ${res.status}`);
  }

  return res.json();
}

// ── Injected functions (run in page context) ──────────────────────────────────
function triggerPageAnalysis(srcUrl) {
  // This runs in the page — calls showAuthrixOverlay which is defined in content.js
  if (typeof window.__authrixAnalyze === 'function') {
    window.__authrixAnalyze(srcUrl);
  } else {
    console.warn('[Authrix] Content script not ready');
  }
}

function showAuthrixOverlay(url) {
  if (typeof window.__authrixAnalyze === 'function') {
    window.__authrixAnalyze(url);
  }
}
