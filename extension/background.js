/**
 * Authrix Extension — Background Service Worker v2
 *
 * Strategy: Use chrome.tabCapture to record the tab's live video stream
 * for N seconds, then send the recorded blob to the local FastAPI backend.
 * No video download needed — works on any platform.
 */

const API_BASE    = 'http://localhost:8000';
const CAPTURE_SEC = 12;   // seconds to record (enough for frame sampling)

// ── Context menu ──────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'authrix-capture',
    title:    '🔍 Analyze with Authrix (capture tab)',
    contexts: ['page', 'video', 'frame'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'authrix-capture' && tab?.id) {
    startCapture(tab.id);
  }
});

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'START_CAPTURE') {
    const tabId = sender.tab?.id || msg.tabId;
    startCapture(tabId)
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

  if (msg.type === 'SEND_BLOB_CHUNKS') {
    // Receive recorded video chunks from offscreen/content, send to backend
    receiveAndAnalyze(msg.chunks, msg.mimeType, sender.tab?.id)
      .then(result => {
        chrome.storage.local.set({ lastResult: { ...result, file: 'Tab capture' } });
        // Send result back to the content script on that tab
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_RESULT', result });
        }
        sendResponse({ ok: true, result });
      })
      .catch(e => {
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, { type: 'ANALYSIS_ERROR', error: e.message });
        }
        sendResponse({ ok: false, error: e.message });
      });
    return true;
  }

  if (msg.type === 'ANALYSIS_ERROR_FROM_CONTENT') {
    // Bubble up errors from content script recording
    console.error('[Authrix BG] Content error:', msg.error);
  }
});

// ── Start tab capture ─────────────────────────────────────────────────────────
async function startCapture(tabId) {
  if (!tabId) throw new Error('No tab ID');

  // Tell content script to show loading overlay
  await chrome.tabs.sendMessage(tabId, { type: 'SHOW_CAPTURE_OVERLAY' });

  // Get a MediaStream for the tab using tabCapture
  // tabCapture.getMediaStreamId gives us a stream ID usable in content scripts
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(id);
    });
  });

  // Send stream ID to content script — it will record and send back chunks
  await chrome.tabs.sendMessage(tabId, {
    type:       'RECORD_STREAM',
    streamId:   streamId,
    durationMs: CAPTURE_SEC * 1000,
  });
}

// ── Receive chunks and analyze ────────────────────────────────────────────────
async function receiveAndAnalyze(base64Chunks, mimeType, tabId) {
  // Reconstruct blob from base64 chunks
  const byteArrays = base64Chunks.map(chunk => {
    const binary = atob(chunk);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  });

  const blob     = new Blob(byteArrays, { type: mimeType || 'video/webm' });
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
