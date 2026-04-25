/**
 * Authrix Extension — Popup Script v3
 */

const API_BASE = 'https://aarav13-authrix.hf.space';

document.addEventListener('DOMContentLoaded', async () => {
  const online = await checkHealth();
  updatePageInfo();
  loadLastResult();
  wireButtons(online);
});

// ── Health check ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge     = document.getElementById('statusBadge');
  const modelInfo = document.getElementById('modelInfo');
  const warn      = document.getElementById('offline-warn');

  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    const d   = await res.json();

    if (d.ready) {
      badge.textContent = 'ONLINE';
      badge.classList.remove('offline', 'loading');
      modelInfo.textContent = (d.model || 'VIT ENSEMBLE').toUpperCase().slice(0, 22);
      if (warn) warn.style.display = 'none';
      return true;
    }

    badge.textContent = 'LOADING…';
    badge.classList.remove('offline');
    badge.classList.add('loading');
    if (warn) warn.style.display = 'none';
    return false;

  } catch {
    badge.textContent = 'OFFLINE';
    badge.classList.add('offline');
    badge.classList.remove('loading');
    if (warn) warn.style.display = 'block';
    return false;
  }
}

// ── Update page info ──────────────────────────────────────────────────────────
async function updatePageInfo() {
  const title = document.getElementById('pageTitle');
  const sub   = document.getElementById('pageSub');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.title) {
      title.textContent = tab.title.length > 44 ? tab.title.slice(0, 41) + '…' : tab.title;
    }
    if (tab?.url) {
      try { sub.textContent = new URL(tab.url).hostname; }
      catch { sub.textContent = 'Ready to capture'; }
    }
  } catch {
    title.textContent = 'Current page';
    sub.textContent   = 'Ready to capture';
  }
}

// ── Wire buttons ──────────────────────────────────────────────────────────────
function wireButtons(online) {
  const btnCapture = document.getElementById('btnCapture');
  const btnUrl     = document.getElementById('btnUrl');
  const urlInput   = document.getElementById('urlInput');

  // Capture button
  btnCapture.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id });
    window.close();
  });

  // URL analyze button
  btnUrl.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ type: 'ANALYZE_URL', url, tabId: tab?.id });
    window.close();
  });

  // Allow Enter key in URL input
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnUrl.click();
  });
}

// ── Load last result ──────────────────────────────────────────────────────────
function loadLastResult() {
  chrome.storage.local.get('lastResult', ({ lastResult }) => {
    if (!lastResult) return;

    const el = document.getElementById('last-result');
    el.style.display = 'block';

    const isFake = lastResult.result === 'FAKE';
    const color  = isFake ? '#ff4466' : '#00ff9c';
    const conf   = lastResult.confidence ?? 0;

    const verdict = document.getElementById('lastVerdict');
    verdict.textContent = lastResult.result;
    verdict.style.color = color;

    const confEl = document.getElementById('lastConf');
    confEl.textContent = conf + '%';
    confEl.style.color = color;

    const fileEl = document.getElementById('lastFile');
    const fileStr = lastResult.file || 'Tab capture';
    fileEl.textContent = fileStr.length > 50 ? fileStr.slice(0, 47) + '…' : fileStr;

    const bar = document.getElementById('lastBar');
    bar.style.background = isFake
      ? 'linear-gradient(90deg,#880022,#ff4466)'
      : 'linear-gradient(90deg,#006633,#00ff9c)';
    setTimeout(() => { bar.style.width = conf + '%'; }, 80);
  });
}
