/**
 * Authrix Extension — Popup Script
 */

const API_BASE = 'http://localhost:8000';

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await checkHealth();
  await detectPageVideo();
  loadLastResult();
  wireButtons();
});

// ── Health check ──────────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = document.getElementById('statusBadge');
  const modelInfo = document.getElementById('modelInfo');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const d   = await res.json();
    if (d.ready) {
      badge.textContent = 'ONLINE';
      badge.classList.remove('offline');
      modelInfo.textContent = (d.model || 'VIT ENSEMBLE').toUpperCase().slice(0, 22);
    } else {
      badge.textContent = 'LOADING';
    }
  } catch {
    badge.textContent = 'OFFLINE';
    badge.classList.add('offline');
  }
}

// ── Detect video on current tab ───────────────────────────────────────────────
async function detectPageVideo() {
  const btn   = document.getElementById('btnAnalyzePage');
  const title = document.getElementById('pageTitle');
  const sub   = document.getElementById('pageSub');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectVideosOnPage,
    });

    const found = results?.[0]?.result;
    if (found?.url) {
      title.textContent = found.title || 'Video detected';
      sub.textContent   = truncateUrl(found.url);
      btn.disabled = false;
      btn.dataset.url = found.url;
    } else {
      title.textContent = 'No video detected';
      sub.textContent   = 'Try right-clicking a video element';
      btn.disabled = true;
    }
  } catch {
    title.textContent = 'Cannot access this page';
    sub.textContent   = 'Extension pages are restricted';
  }
}

// ── Runs in page context ──────────────────────────────────────────────────────
function detectVideosOnPage() {
  // Check <video> elements
  const videos = Array.from(document.querySelectorAll('video'));
  for (const v of videos) {
    const src = v.src || v.querySelector('source')?.src;
    if (src && src.startsWith('http')) {
      return { url: src, title: document.title };
    }
  }
  // YouTube
  const ytMatch = location.href.match(/[?&]v=([^&]+)/);
  if (ytMatch) {
    return { url: location.href, title: document.title };
  }
  return null;
}

// ── Wire buttons ──────────────────────────────────────────────────────────────
function wireButtons() {
  // Analyze page video
  document.getElementById('btnAnalyzePage').addEventListener('click', async () => {
    const btn = document.getElementById('btnAnalyzePage');
    const url = btn.dataset.url;
    if (!url) return;
    await injectAndAnalyze(url);
  });

  // Manual URL
  document.getElementById('btnGo').addEventListener('click', async () => {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) return;
    await injectAndAnalyze(url);
  });

  document.getElementById('urlInput').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const url = e.target.value.trim();
      if (url) await injectAndAnalyze(url);
    }
  });
}

// ── Inject overlay into active tab and trigger analysis ───────────────────────
async function injectAndAnalyze(url) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (videoUrl) => {
        if (typeof window.__authrixAnalyze === 'function') {
          window.__authrixAnalyze(videoUrl);
        }
      },
      args: [url],
    });

    // Close popup so user can see the overlay
    window.close();
  } catch (err) {
    console.error('[Authrix popup]', err);
  }
}

// ── Load last result from storage ────────────────────────────────────────────
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
    document.getElementById('lastFile').textContent    = lastResult.file || '';

    const bar = document.getElementById('lastBar');
    bar.style.background = isFake
      ? 'linear-gradient(90deg,#880022,#ff4466)'
      : 'linear-gradient(90deg,#006633,#00ff9c)';
    setTimeout(() => { bar.style.width = lastResult.confidence + '%'; }, 80);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 25);
  } catch {
    return url.slice(0, 40);
  }
}
