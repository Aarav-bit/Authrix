/**
 * Authrix Extension — Content Script
 * Injected into every page. Handles overlay UI and video detection.
 */

// ── Register global trigger ───────────────────────────────────────────────────
window.__authrixAnalyze = function(hintUrl) {
  const url = hintUrl || findBestVideoUrl();
  if (!url) {
    showToast('⚠ No video found on this page', 'warn');
    return;
  }
  showAnalysisOverlay(url);
};

// ── Find best video URL on the page ──────────────────────────────────────────
function findBestVideoUrl() {
  // 1. <video> element with src
  const videos = Array.from(document.querySelectorAll('video'));
  for (const v of videos) {
    if (v.src && v.src.startsWith('http')) return v.src;
    const src = v.querySelector('source');
    if (src?.src) return src.src;
  }

  // 2. YouTube — extract video ID and use yt-dlp-style URL
  const ytMatch = location.href.match(/[?&]v=([^&]+)/);
  if (ytMatch) return `https://www.youtube.com/watch?v=${ytMatch[1]}`;

  // 3. Twitter/X video
  const twitterVideo = document.querySelector('video[src*="video.twimg.com"]');
  if (twitterVideo?.src) return twitterVideo.src;

  return null;
}

// ── Main overlay ──────────────────────────────────────────────────────────────
function showAnalysisOverlay(videoUrl) {
  // Remove existing overlay
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

      <div id="authrix-url-bar">
        <span id="authrix-url-text">${truncateUrl(videoUrl)}</span>
      </div>

      <!-- Loading state -->
      <div id="authrix-loading">
        <div id="authrix-radar">
          <div class="authrix-ring r1"></div>
          <div class="authrix-ring r2"></div>
          <div class="authrix-ring r3"></div>
          <div id="authrix-radar-dot"></div>
        </div>
        <div id="authrix-loading-text">Initializing analysis...</div>
        <div id="authrix-steps">
          <div class="authrix-step" id="as0">🎬 Extracting frames</div>
          <div class="authrix-step" id="as1">👤 Detecting faces</div>
          <div class="authrix-step" id="as2">🧠 Running AI models</div>
          <div class="authrix-step" id="as3">📊 Generating report</div>
        </div>
        <div id="authrix-note">⚠ Large videos may take 15-30s</div>
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
        <div id="authrix-actions">
          <button id="authrix-reanalyze">↺ Re-analyze</button>
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

  // Wire close
  document.getElementById('authrix-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Start analysis
  startAnalysis(videoUrl);
}

// ── Run analysis ──────────────────────────────────────────────────────────────
async function startAnalysis(videoUrl) {
  showState('loading');
  animateSteps();

  try {
    // Check if server is running first
    const health = await fetch('http://localhost:8000/health').catch(() => null);
    if (!health?.ok) {
      throw new Error('SERVER_OFFLINE');
    }

    // Send URL to background for fetching + analysis
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_URL',
      url: videoUrl,
    });

    stopStepAnimation();

    if (!response.ok) throw new Error(response.error || 'Analysis failed');

    renderResult(response.result, videoUrl);
  } catch (err) {
    stopStepAnimation();
    showError(err.message, videoUrl);
  }
}

// ── Render result ─────────────────────────────────────────────────────────────
function renderResult(data, videoUrl) {
  const isFake = data.result === 'FAKE';
  const conf   = data.confidence || 0;
  const color  = isFake ? '#ff4466' : '#00ff9c';

  // Badge
  const badge = document.getElementById('authrix-badge');
  badge.textContent = isFake ? '⚠' : '✓';
  badge.style.color = color;
  badge.style.borderColor = color;
  badge.style.boxShadow = `0 0 16px ${color}44`;

  // Verdict
  const vt = document.getElementById('authrix-verdict-text');
  vt.textContent = isFake ? 'DEEPFAKE DETECTED' : 'AUTHENTIC VIDEO';
  vt.style.color = color;

  // Confidence
  document.getElementById('authrix-conf').textContent = conf + '%';
  document.getElementById('authrix-conf').style.color = color;

  // Bar
  const bar = document.getElementById('authrix-conf-bar');
  bar.style.background = isFake
    ? 'linear-gradient(90deg,#880022,#ff4466)'
    : 'linear-gradient(90deg,#006633,#00ff9c)';
  bar.style.boxShadow = `0 0 8px ${color}66`;
  setTimeout(() => { bar.style.width = conf + '%'; }, 80);

  // Details (first 3)
  const dl = document.getElementById('authrix-details');
  dl.innerHTML = (data.details || []).slice(0, 3).map(d =>
    `<div class="authrix-detail" style="border-left-color:${color};">${escHtml(d)}</div>`
  ).join('');

  // Audio
  const audioRow = document.getElementById('authrix-audio-row');
  if (data.audio?.available) {
    const isAI = data.audio.result === 'AI_VOICE';
    const isMismatch = data.audio.result === 'AV_MISMATCH';
    const aColor = (isAI || isMismatch) ? '#ff4466' : '#00ff9c';
    document.getElementById('authrix-audio-icon').textContent =
      (isAI || isMismatch) ? '🤖' : '🎙️';
    document.getElementById('authrix-audio-label').textContent =
      isMismatch ? 'AV Mismatch — face-swap detected' :
      isAI ? `AI Voice (${data.audio.confidence}%)` :
      `Human Voice (${data.audio.confidence}%)`;
    document.getElementById('authrix-audio-label').style.color = aColor;
    audioRow.style.display = 'flex';
  }

  // Actions
  document.getElementById('authrix-reanalyze').onclick = () => startAnalysis(videoUrl);
  document.getElementById('authrix-open-app').onclick  = () => window.open('http://localhost:8000', '_blank');

  showState('result');
}

// ── Show error ────────────────────────────────────────────────────────────────
function showError(message, videoUrl) {
  const isOffline = message === 'SERVER_OFFLINE';
  document.getElementById('authrix-error-msg').textContent =
    isOffline ? 'Authrix server is not running' : message;
  document.getElementById('authrix-error-hint').textContent =
    isOffline
      ? 'Start the server: cd backend && python -m uvicorn main:app --port 8000'
      : 'The video may be DRM-protected or require authentication.';
  document.getElementById('authrix-retry').onclick = () => startAnalysis(videoUrl);
  showState('error');
}

// ── State management ──────────────────────────────────────────────────────────
function showState(state) {
  document.getElementById('authrix-loading').style.display = state === 'loading' ? 'flex' : 'none';
  document.getElementById('authrix-result').style.display  = state === 'result'  ? 'block' : 'none';
  document.getElementById('authrix-error').style.display   = state === 'error'   ? 'flex' : 'none';
}

// ── Step animation ────────────────────────────────────────────────────────────
let _stepTimers = [];
const _stepDelays = [0, 2000, 5000, 9000];
const _stepMsgs = [
  'Downloading video frames...',
  'Detecting facial regions...',
  'Running ViT ensemble inference...',
  'Compiling authenticity report...',
];

function animateSteps() {
  _stepTimers = [];
  _stepDelays.forEach((delay, i) => {
    const t = setTimeout(() => {
      document.querySelectorAll('.authrix-step').forEach((el, j) => {
        el.classList.toggle('active', j === i);
        el.classList.toggle('done', j < i);
      });
      document.getElementById('authrix-loading-text').textContent = _stepMsgs[i];
    }, delay);
    _stepTimers.push(t);
  });
}

function stopStepAnimation() {
  _stepTimers.forEach(clearTimeout);
  _stepTimers = [];
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'authrix-toast authrix-toast-' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').pop() || u.hostname;
    return u.hostname + '/…/' + path.slice(0, 30);
  } catch {
    return url.slice(0, 50);
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
