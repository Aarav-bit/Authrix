/**
 * Authrix Extension — Background Service Worker v3
 *
 * Architecture (MV3-compliant):
 *   1. tabCapture.getMediaStreamId()  → get stream ID for the target tab
 *   2. Create offscreen document      → only place getUserMedia(tab) works in MV3
 *   3. offscreen.js records the stream and sends BLOB_READY back here
 *   4. We POST the blob to the local FastAPI backend
 *   5. Result is sent to the content script overlay on the original tab
 */

const API_BASE    = 'http://localhost:8000';
const CAPTURE_SEC = 8;   // Reduced from 20s — 8s gives enough frames for accurate detection
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

// ── Context menu ──────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'authrix-capture',
    title:    '🔍 Analyze with Authrix',
    contexts: ['page', 'video', 'frame'],
  });
  chrome.contextMenus.create({
    id:       'authrix-url',
    title:    '🔗 Analyze video URL with Authrix',
    contexts: ['link'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'authrix-capture' && tab?.id) {
    startCapture(tab.id);
  }
  if (info.menuItemId === 'authrix-url' && tab?.id && info.linkUrl) {
    analyzeUrl(info.linkUrl, tab.id);
  }
});

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'START_CAPTURE') {
    const tabId = msg.tabId || sender.tab?.id;
    startCapture(tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'ANALYZE_URL') {
    const tabId = msg.tabId || sender.tab?.id;
    analyzeUrl(msg.url, tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === 'CHECK_HEALTH') {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(d => sendResponse({ ok: true, data: d }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // ── Messages from offscreen document ─────────────────────────────────────
  if (msg.type === 'BLOB_READY') {
    handleBlobReady(msg.chunks, msg.mimeType, msg.tabId, msg.totalSize);
    return false;
  }

  if (msg.type === 'RECORD_PROGRESS') {
    if (msg.tabId) {
      chrome.tabs.sendMessage(msg.tabId, {
        type: 'CAPTURE_PROGRESS',
        elapsed: msg.elapsed,
        total:   msg.total,
      }).catch(() => {});
    }
    return false;
  }

  if (msg.type === 'RECORD_ERROR') {
    if (msg.tabId) {
      chrome.tabs.sendMessage(msg.tabId, {
        type:  'ANALYSIS_ERROR',
        error: msg.error,
      }).catch(() => {});
    }
    closeOffscreen();
    return false;
  }
});

// ── Start tab capture ─────────────────────────────────────────────────────────
async function startCapture(tabId) {
  if (!tabId) throw new Error('No tab ID');

  // Show loading overlay on the tab
  await chrome.tabs.sendMessage(tabId, { type: 'SHOW_CAPTURE_OVERLAY' }).catch(() => {
    // Content script may not be injected yet — inject it
    return chrome.scripting.executeScript({
      target: { tabId },
      files:  ['content.js'],
    }).then(() =>
      chrome.tabs.sendMessage(tabId, { type: 'SHOW_CAPTURE_OVERLAY' })
    );
  });

  // Get stream ID (must be called from background, not offscreen)
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, id => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });

  // Ensure offscreen document exists
  await ensureOffscreen();

  // Tell offscreen to start recording
  await chrome.runtime.sendMessage({
    type:       'RECORD_OFFSCREEN',
    streamId,
    durationMs: CAPTURE_SEC * 1000,
    tabId,
  });
}

// ── Analyze a direct video URL ────────────────────────────────────────────────
async function analyzeUrl(url, tabId) {
  if (!url) throw new Error('No URL provided');

  if (tabId) {
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_URL_ANALYSIS_OVERLAY', url }).catch(() => {});
  }

  try {
    const res = await fetch(`${API_BASE}/analyze-url`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Backend error ${res.status}`);
    }

    const result = await res.json();
    result.file  = url.length > 60 ? url.slice(0, 57) + '…' : url;

    chrome.storage.local.set({ lastResult: result });

    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_RESULT', result }).catch(() => {});
    }
  } catch (err) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_ERROR', error: err.message }).catch(() => {});
    }
    throw err;
  }
}

// ── Handle blob from offscreen ────────────────────────────────────────────────
async function handleBlobReady(chunks, mimeType, tabId, totalSize) {
  closeOffscreen();

  try {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_PROGRESS', elapsed: 12, total: 12 }).catch(() => {});
    }

    const result = await submitBlob(chunks, mimeType, totalSize);
    result.file  = 'Tab capture';

    chrome.storage.local.set({ lastResult: result });

    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_RESULT', result }).catch(() => {});
    }
  } catch (err) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'ANALYSIS_ERROR', error: err.message }).catch(() => {});
    }
  }
}

// ── Submit blob to backend ────────────────────────────────────────────────────
async function submitBlob(chunks, mimeType, totalSize) {
  // Reassemble chunks from array format back to Uint8Array
  const uint8Array = new Uint8Array(totalSize);
  let offset = 0;
  
  for (const chunk of chunks) {
    uint8Array.set(chunk, offset);
    offset += chunk.length;
  }

  const blob     = new Blob([uint8Array], { type: mimeType || 'video/webm' });
  const filename = `capture_${Date.now()}.webm`;

  const fd = new FormData();
  fd.append('file', blob, filename);

  const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Backend error ${res.status}`);
  }
  return res.json();
}

// ── Offscreen document management ────────────────────────────────────────────
async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument().catch(() => false);
  if (!existing) {
    await chrome.offscreen.createDocument({
      url:    OFFSCREEN_URL,
      reasons: ['USER_MEDIA'],
      justification: 'Record tab video stream for deepfake analysis',
    });
  }
}

async function closeOffscreen() {
  const exists = await chrome.offscreen.hasDocument().catch(() => false);
  if (exists) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}
