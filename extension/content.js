/**
 * Authrix Extension — Content Script v3
 *
 * Responsibilities:
 *  - Render the overlay UI (loading, result, error states)
 *  - Relay messages from background to the overlay
 *  - Recording is handled by offscreen.js (MV3 requirement)
 */

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'SHOW_CAPTURE_OVERLAY') {
    showOverlay('capture');
    sendResponse({ ok: true });
  }

  if (msg.type === 'SHOW_URL_ANALYSIS_OVERLAY') {
    showOverlay('url', msg.url);
    sendResponse({ ok: true });
  }

  if (msg.type === 'CAPTURE_PROGRESS') {
    const pct = Math.min(95, Math.round((msg.elapsed / msg.total) * 65));
    updateLoadingText(`Recording: ${msg.elapsed}s / ${msg.total}s`);
    if (msg.elapsed === 1) activateStep(0);
    if (msg.elapsed >= msg.total) {
      activateStep(1);
      updateLoadingText('Processing frames — running AI analysis…');
    }
  }

  if (msg.type === 'ANALYSIS_RESULT') {
    activateStep(3);
    renderResult(msg.result);
  }

  if (msg.type === 'ANALYSIS_ERROR') {
    showError(msg.error);
  }
});

// ── Show overlay ──────────────────────────────────────────────────────────────
function showOverlay(mode = 'capture', url = '') {
  document.getElementById('authrix-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'authrix-overlay';
  overlay.innerHTML = `
    <div id="authrix-panel">

      <!-- Header -->
      <div id="authrix-header">
        <div id="authrix-logo">
          <span id="authrix-logo-icon">◉</span>
          <span>AUTHRIX AI</span>
        </div>
        <button id="authrix-close" title="Close">✕</button>
      </div>

      <!-- Loading state -->
      <div id="authrix-loading">
        <div id="authrix-radar">
          <div class="authrix-ring r1"></div>
          <div class="authrix-ring r2"></div>
          <div class="authrix-ring r3"></div>
          <div id="authrix-radar-dot"></div>
        </div>
        <div id="authrix-loading-text">
          ${mode === 'url' ? 'Downloading &amp; analyzing video…' : 'Initializing capture…'}
        </div>
        <div id="authrix-steps">
          <div class="authrix-step" id="as0">
            ${mode === 'url' ? '⬇️ Downloading video' : '🎬 Recording tab stream'}
          </div>
          <div class="authrix-step" id="as1">🖼️ Extracting frames</div>
          <div class="authrix-step" id="as2">🧠 Running AI models</div>
          <div class="authrix-step" id="as3">📊 Generating report</div>
        </div>
        ${mode === 'url'
          ? `<div id="authrix-note" style="font-family:monospace;font-size:10px;word-break:break-all;">${escHtml(url.slice(0, 80))}${url.length > 80 ? '…' : ''}</div>`
          : `<div id="authrix-note">Recording ~8 seconds of video for analysis</div>`
        }
      </div>

      <!-- Result state -->
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
        <div id="authrix-meta"></div>
        <div id="authrix-actions">
          <button id="authrix-reanalyze">↺ Capture Again</button>
          <button id="authrix-open-app">Open Authrix App ↗</button>
        </div>
      </div>

      <!-- Error state -->
      <div id="authrix-error" style="display:none;">
        <div id="authrix-error-icon">⚠</div>
        <div id="authrix-error-msg"></div>
        <div id="authrix-error-hint"></div>
        <button id="authrix-retry">↺ Retry</button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // Wire up buttons
  document.getElementById('authrix-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('authrix-open-app').onclick = () =>
    window.open('https://aarav13-authrix.hf.space', '_blank');

  document.getElementById('authrix-reanalyze').onclick = () =>
    chrome.runtime.sendMessage({ type: 'START_CAPTURE' });

  document.getElementById('authrix-retry').onclick = () =>
    chrome.runtime.sendMessage({ type: 'START_CAPTURE' });

  // Auto-activate first step for URL mode (no recording phase)
  if (mode === 'url') activateStep(1);
}

// ── Loading helpers ───────────────────────────────────────────────────────────
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

// ── Render result ─────────────────────────────────────────────────────────────
function renderResult(data) {
  const isFake = data.result === 'FAKE';
  const conf   = data.confidence ?? 0;
  const color  = isFake ? '#ff4466' : '#00ff9c';

  // Badge
  const badge = document.getElementById('authrix-badge');
  if (badge) {
    badge.textContent       = isFake ? '⚠' : '✓';
    badge.style.color       = color;
    badge.style.borderColor = color;
    badge.style.boxShadow   = `0 0 16px ${color}44`;
  }

  // Verdict text
  const vt = document.getElementById('authrix-verdict-text');
  if (vt) { vt.textContent = isFake ? 'DEEPFAKE DETECTED' : 'AUTHENTIC VIDEO'; vt.style.color = color; }

  // Confidence number
  const cv = document.getElementById('authrix-conf');
  if (cv) { cv.textContent = conf + '%'; cv.style.color = color; }

  // Confidence bar
  const bar = document.getElementById('authrix-conf-bar');
  if (bar) {
    bar.style.background = isFake
      ? 'linear-gradient(90deg,#880022,#ff4466)'
      : 'linear-gradient(90deg,#006633,#00ff9c)';
    bar.style.boxShadow = `0 0 8px ${color}66`;
    setTimeout(() => { bar.style.width = conf + '%'; }, 80);
  }

  // Detail bullets (max 3)
  const dl = document.getElementById('authrix-details');
  if (dl) {
    dl.innerHTML = (data.details || []).slice(0, 3).map(d =>
      `<div class="authrix-detail" style="border-left-color:${color};">${escHtml(d)}</div>`
    ).join('');
  }

  // Audio row
  const audioRow = document.getElementById('authrix-audio-row');
  if (audioRow && data.audio?.available) {
    const isAI      = data.audio.result === 'AI_VOICE';
    const isMismatch = data.audio.result === 'AV_MISMATCH';
    const aColor    = (isAI || isMismatch) ? '#ff4466' : '#00ff9c';
    const audioIcon  = document.getElementById('authrix-audio-icon');
    const audioLabel = document.getElementById('authrix-audio-label');
    if (audioIcon)  audioIcon.textContent  = (isAI || isMismatch) ? '🤖' : '🎙️';
    if (audioLabel) {
      audioLabel.textContent = isMismatch
        ? 'AV Mismatch — face-swap detected'
        : isAI
          ? `AI Voice (${data.audio.confidence}%)`
          : `Human Voice (${data.audio.confidence}%)`;
      audioLabel.style.color = aColor;
    }
    audioRow.style.display = 'flex';
  }

  // Metadata row
  const meta = document.getElementById('authrix-meta');
  if (meta && data.metadata) {
    const m = data.metadata;
    const parts = [];
    if (m.video_duration_sec) parts.push(`${m.video_duration_sec}s`);
    if (m.resolution && m.resolution !== '0x0') parts.push(m.resolution);
    if (m.frames_with_faces != null) parts.push(`${m.frames_with_faces} faces`);
    if (data.processing_time_sec) parts.push(`${data.processing_time_sec}s analysis`);
    if (parts.length) {
      meta.textContent = parts.join(' · ');
      meta.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.25);margin-bottom:12px;font-family:monospace;';
    }
  }

  showState('result');
}

// ── Show error ────────────────────────────────────────────────────────────────
function showError(message) {
  const isOffline = !message || message.includes('fetch') || message.includes('Failed to fetch') || message.includes('ERR_CONNECTION');
  const errMsg  = document.getElementById('authrix-error-msg');
  const errHint = document.getElementById('authrix-error-hint');

  if (errMsg) {
    errMsg.textContent = isOffline
      ? 'Authrix server is not running'
      : (message || 'Unknown error');
  }
  if (errHint) {
    errHint.textContent = isOffline
      ? 'Visit https://aarav13-authrix.hf.space to check server status'
      : 'Make sure a video is playing before capturing.';
  }
  showState('error');
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
