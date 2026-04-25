/**
 * Authrix Extension — Popup Script v2
 * Simple popup: check health, show status, trigger capture on click.
 */

const API_BASE = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', async () => {
  await checkHealth();
  loadLastResult();
  wireButtons();
  updatePageInfo();
});

// ── Health check ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge     = document.getElementById('statusBadge');
  const modelInfo = document.getElementById('modelInfo');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const d   = await res.json();
    if (d.ready) {
      badge.textContent = 'ONLINE';
      badge.classList.remove('offline');
      modelInfo.textContent = (d.model || 'VIT ENSEMBLE').toUpperCase().slice(0, 22);
      return true;
    }
    badge.textContent = 'LOADING...';
    return false;
  } catch {
    badge.textContent = 'OFFLINE';
    badge.classList.add('offline');
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
      title.textContent = tab.title.slice(0, 45);
      sub.textContent   = new URL(tab.url).hostname;
    }
  } catch {
    title.textContent = 'Current page';
    sub.textContent   = 'Ready to capture';
  }
}

// ── Wire buttons ──────────────────────────────────────────────────────────────
function wireButtons() {
  document.getElementById('btnCapture').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Trigger capture from background (needs to be initiated from background for tabCapture)
    await chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id });
    window.close(); // close popup so overlay is visible
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

    document.getElementById('lastVerdict').textContent = lastResult.result;
    document.getElementById('lastVerdict').style.color = color;
    document.getElementById('lastConf').textContent    = lastResult.confidence + '%';
    document.getElementById('lastConf').style.color    = color;
    document.getElementById('lastFile').textContent    = lastResult.file || 'Tab capture';

    const bar = document.getElementById('lastBar');
    bar.style.background = isFake
      ? 'linear-gradient(90deg,#880022,#ff4466)'
      : 'linear-gradient(90deg,#006633,#00ff9c)';
    setTimeout(() => { bar.style.width = lastResult.confidence + '%'; }, 80);
  });
}
