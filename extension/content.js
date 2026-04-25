/**
 * Authrix Extension — Content Script v2
 *
 * Handles:
 * 1. Overlay UI (loading, result, error)
 * 2. Tab stream recording via MediaRecorder (using streamId from background)
 * 3. Sending recorded chunks back to background for analysis
 */

// ── Message listener from background ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SHOW_CAPTURE_OVERLAY') {
    showOverlay();
    sendResponse({ ok: true });
  }

  if (msg.type === 'RECORD_STREAM') {
    recordStream(msg.streamId, msg.durationMs);
    sendResponse({ ok: true });
  }

  if (msg.type === 'ANALYSIS_RESULT') {
    renderResult(msg.result);
  }

  if (msg.type === 'ANALYSIS_ERROR') {
    showError(msg.error);
  }
});

// ── Global trigger (from background context menu) ─────────────────────────────
window.__authrixCapture = function() {
  chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
};

// ── Record stream ─────────────────────────────────────────────────────────────
async function recordStream(streamId, durationMs) {
  try {
    updateLoadingText('Connecting to video stream...');

    // Get the MediaStream from the stream ID
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    });

    updateLoadingText('Recording video stream...');
    activateStep(0);

    // Pick best supported format
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
    const chunks   = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      activateStep(1);
      updateLoadingText('Processing captured frames...');

      try {
        // Convert chunks to base64 for message passing
        const blob    = new Blob(chunks, { type: mimeType });
        const base64  = await blobToBase64(blob);

        activateStep(2);
        updateLoadingText('Running AI analysis...');

        // Send to background for backend submission
        chrome.runtime.sendMessage({
          type:       'SEND_BLOB_CHUNKS',
          chunks:     [base64],   // single base64 string of full blob
          mimeType:   mimeType,
        });
      } catch (err) {
        showError('Failed to process recording: ' + err.message);
        chrome.runtime.sendMessage({ type: 'ANALYSIS_ERROR_FROM_CONTENT', error: err.message });
      }
    };

    recorder.onerror = e => {
      showError('Recording error: ' + e.error?.message);
    };

    // Record for durationMs then stop
    recorder.start(1000); // collect data every 1s
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, durationMs);

    // Update progress during recording
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      if (recorder.state !== 'recording') { clearInterval(progressInterval); return; }
      const elapsed = (Date.now() - startTime) / 1000;
      const total   = durationMs / 1000;
      const pct     = Math.min(99, Math.round((elapsed / total) * 60));
      updateLoadingText(`Recording: ${elapsed.toFixed(0)}s / ${total}s (${pct}% captured)`);
    }, 500);

  } catch (err) {
    showError(err.message.includes('Permission')
      ? 'Tab capture permission denied. Try reloading the page.'
      : 'Stream capture failed: ' + err.message);
  }
}

// ── Overlay UI ────────────────────────────────────────────────────────────────
function showOverlay() {
  document.getElementById('authrix-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'authrix-overlay';
  overlay.innerHTML = `
    <div id="authrix-panel">
      <div id="authrix-header">
        <div id="authrix-logo">
          <span id="authrix-logo-icon">◉</span>
          <span>AUTHRIX AI</span>
        </div>
        <button id="authrix-close">✕</button>
      </div>

      <!-- Loading -->
      <div id="authrix-loading">
        <div id="authrix-radar">
          <div class="authrix-ring r1"></div>
          <div class="authrix-ring r2"></div>
          <div class="authrix-ring r3"></div>
          <div id="authrix-radar-dot"></div>
        </div>
        <div id="authrix-loading-text">Initializing capture...</div>
        <div id="authrix-steps">
          <div class="authrix-step" id="as0">🎬 Recording tab stream</div>
          <div class="authrix-step" id="as1">🖼️ Extracting frames</div>
          <div class="authrix-step" id="as2">🧠 Running AI models</div>
          <div class="authrix-step" id="as3">📊 Generating report</div>
        </div>
        <div id="authrix-note">Recording ~12 seconds of video for analysis</div>
      </div>

      <!-- Result -->
      <div id="authrix-result" style="display:none;">
        <div id="authrix-verdict-row">
          <div id="authrix-badge"></div>
          <div id="authrix-verdict-text"></div>
          <div id="authrix-conf"></div>
        </div>
        <div id="authrix-conf-bar-wrap">
          <div id="authrix-conf-bar"></div>
        </div>
        <div id="authrix-details"></div>
        <div id="authrix-audio-row" style="display:none;">
          <span id="authrix-audio-icon">🎙️</span>
          <span id="authrix-audio-label"></span>
        </div>
        <div id="authrix-actions">
          <button id="authrix-reanalyze">↺ Capture Again</button>
          <button id="authrix-open-app">Open Authrix App ↗</button>
        </div>
      </div>

      <!-- Error -->
      <div id="authrix-error" style="display:none;">
        <div id="authrix-error-icon">⚠</div>
        <div id="authrix-error-msg"></div>
        <div id="authrix-error-hint"></div>
        <button id="authrix-retry">↺ Retry</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('authrix-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('authrix-open-app').onclick = () =>
    window.open('http://localhost:8000', '_blank');
  document.getElementById('authrix-reanalyze').onclick = () =>
    chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
  document.getElementById('authrix-retry').onclick = () =>
    chrome.runtime.sendMessage({ type: 'START_CAPTURE' });
}

function updateLoadingText(text) {
  const el = document.getElementById('authrix-loading-text');
  if (el) el.textContent = text;
}

function activateStep(idx) {
  document.querySelectorAll('.authrix-step').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    el.classList.toggle('done',   i < idx);
  });
}

function showState(state) {
  const loading = document.getElementById('authrix-loading');
  const result  = document.getElementById('authrix-result');
  const error   = document.getElementById('authrix-error');
  if (loading) loading.style.display = state === 'loading' ? 'flex' : 'none';
  if (result)  result.style.display  = state === 'result'  ? 'block' : 'none';
  if (error)   error.style.display   = state === 'error'   ? 'flex'  : 'none';
}

function renderResult(data) {
  activateStep(3);

  const isFake = data.result === 'FAKE';
  const conf   = data.confidence || 0;
  const color  = isFake ? '#ff4466' : '#00ff9c';

  const badge = document.getElementById('authrix-badge');
  if (badge) {
    badge.textContent   = isFake ? '⚠' : '✓';
    badge.style.color   = color;
    badge.style.borderColor = color;
    badge.style.boxShadow   = `0 0 16px ${color}44`;
  }

  const vt = document.getElementById('authrix-verdict-text');
  if (vt) { vt.textContent = isFake ? 'DEEPFAKE DETECTED' : 'AUTHENTIC VIDEO'; vt.style.color = color; }

  const cv = document.getElementById('authrix-conf');
  if (cv) { cv.textContent = conf + '%'; cv.style.color = color; }

  const bar = document.getElementById('authrix-conf-bar');
  if (bar) {
    bar.style.background = isFake
      ? 'linear-gradient(90deg,#880022,#ff4466)'
      : 'linear-gradient(90deg,#006633,#00ff9c)';
    bar.style.boxShadow = `0 0 8px ${color}66`;
    setTimeout(() => { bar.style.width = conf + '%'; }, 80);
  }

  const dl = document.getElementById('authrix-details');
  if (dl) {
    dl.innerHTML = (data.details || []).slice(0, 3).map(d =>
      `<div class="authrix-detail" style="border-left-color:${color};">${escHtml(d)}</div>`
    ).join('');
  }

  const audioRow = document.getElementById('authrix-audio-row');
  if (audioRow && data.audio?.available) {
    const isAI = data.audio.result === 'AI_VOICE';
    const isMismatch = data.audio.result === 'AV_MISMATCH';
    const aColor = (isAI || isMismatch) ? '#ff4466' : '#00ff9c';
    const audioIcon  = document.getElementById('authrix-audio-icon');
    const audioLabel = document.getElementById('authrix-audio-label');
    if (audioIcon)  audioIcon.textContent  = (isAI || isMismatch) ? '🤖' : '🎙️';
    if (audioLabel) {
      audioLabel.textContent = isMismatch
        ? 'AV Mismatch — face-swap detected'
        : isAI ? `AI Voice (${data.audio.confidence}%)`
               : `Human Voice (${data.audio.confidence}%)`;
      audioLabel.style.color = aColor;
    }
    audioRow.style.display = 'flex';
  }

  showState('result');
}

function showError(message) {
  const isOffline = message?.includes('fetch') || message?.includes('Failed to fetch');
  const errMsg  = document.getElementById('authrix-error-msg');
  const errHint = document.getElementById('authrix-error-hint');
  if (errMsg)  errMsg.textContent  = isOffline ? 'Authrix server is not running' : (message || 'Unknown error');
  if (errHint) errHint.textContent = isOffline
    ? 'Run: cd backend && python -m uvicorn main:app --port 8000'
    : 'Make sure the video is playing before capturing.';
  showState('error');
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
