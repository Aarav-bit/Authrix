/**
 * Authrix Extension — Popup Script
 * Auto-detects and auto-analyzes videos on the current page.
 */

const API_BASE = 'http://localhost:8000';

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const [healthOk, found] = await Promise.all([checkHealth(), detectPageVideo()]);
  loadLastResult();
  wireButtons();

  // AUTO-ANALYZE: if server is online and a video was found, start immediately
  if (healthOk && found) {
    const btn = document.getElementById('btnAnalyzePage');
    if (!btn.disabled) {
      // Small delay so user sees the popup before it closes
      setTimeout(() => btn.click(), 400);
    }
  }
});

// ── Health check — returns true if ready ─────────────────────────────────────
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
    badge.textContent = 'LOADING';
    return false;
  } catch {
    badge.textContent = 'OFFLINE';
    badge.classList.add('offline');
    return false;
  }
}

// ── Detect video on current tab — returns true if found ──────────────────────
async function detectPageVideo() {
  const btn   = document.getElementById('btnAnalyzePage');
  const title = document.getElementById('pageTitle');
  const sub   = document.getElementById('pageSub');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return false;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectVideosOnPage,
    });

    const found = results?.[0]?.result;
    if (found?.url) {
      title.textContent = found.label || found.title || 'Video detected';
      sub.textContent   = truncateUrl(found.url);
      btn.disabled      = false;
      btn.dataset.url   = found.url;
      return true;
    } else {
      title.textContent = 'No video detected';
      sub.textContent   = 'Try right-clicking a video element';
      btn.disabled      = true;
      return false;
    }
  } catch {
    title.textContent = 'Cannot access this page';
    sub.textContent   = 'Extension pages are restricted';
    return false;
  }
}

// ── Runs in page context — comprehensive video detection ─────────────────────
function detectVideosOnPage() {
  const url  = location.href;
  const host = location.hostname;

  // ── YouTube ──────────────────────────────────────────────────────────────
  // youtube.com/watch?v=... or youtu.be/...
  const ytWatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const ytShorts = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  const ytId = (ytWatch?.[1] || ytShort?.[1] || ytShorts?.[1]);
  if (ytId) {
    return {
      url:   `https://www.youtube.com/watch?v=${ytId}`,
      label: '▶ YouTube: ' + (document.title.replace(' - YouTube','').slice(0,40)),
      title: document.title,
      type:  'youtube',
    };
  }

  // ── Twitter / X ───────────────────────────────────────────────────────────
  if (host.includes('twitter.com') || host.includes('x.com')) {
    const twitterVid = document.querySelector('video[src*="video.twimg.com"]');
    if (twitterVid?.src) {
      return { url: twitterVid.src, label: '▶ Twitter/X video', title: document.title, type: 'direct' };
    }
    // Try blob → find the highest quality source
    const allVids = Array.from(document.querySelectorAll('video'));
    for (const v of allVids) {
      const sources = Array.from(v.querySelectorAll('source'));
      for (const s of sources) {
        if (s.src && s.src.startsWith('http')) {
          return { url: s.src, label: '▶ Twitter/X video', title: document.title, type: 'direct' };
        }
      }
    }
  }

  // ── Instagram ─────────────────────────────────────────────────────────────
  if (host.includes('instagram.com')) {
    const igVid = document.querySelector('video');
    if (igVid?.src && igVid.src.startsWith('http')) {
      return { url: igVid.src, label: '▶ Instagram video', title: document.title, type: 'direct' };
    }
  }

  // ── Facebook ──────────────────────────────────────────────────────────────
  if (host.includes('facebook.com') || host.includes('fb.watch')) {
    const fbVid = document.querySelector('video[src*="fbcdn"]');
    if (fbVid?.src) {
      return { url: fbVid.src, label: '▶ Facebook video', title: document.title, type: 'direct' };
    }
  }

  // ── Generic <video> with direct HTTP src ─────────────────────────────────
  const videos = Array.from(document.querySelectorAll('video'));
  for (const v of videos) {
    // Direct src
    if (v.src && v.src.startsWith('http') && !v.src.startsWith('blob:')) {
      return { url: v.src, label: '▶ Video on page', title: document.title, type: 'direct' };
    }
    // <source> children
    const sources = Array.from(v.querySelectorAll('source'));
    for (const s of sources) {
      if (s.src && s.src.startsWith('http')) {
        return { url: s.src, label: '▶ Video on page', title: document.title, type: 'direct' };
      }
    }
  }

  // ── OG / meta video tag ───────────────────────────────────────────────────
  const ogVideo = document.querySelector('meta[property="og:video"], meta[property="og:video:url"]');
  if (ogVideo?.content) {
    return { url: ogVideo.content, label: '▶ Embedded video', title: document.title, type: 'meta' };
  }

  return null;
}

// ── Wire buttons ──────────────────────────────────────────────────────────────
function wireButtons() {
  document.getElementById('btnAnalyzePage').addEventListener('click', async () => {
    const url = document.getElementById('btnAnalyzePage').dataset.url;
    if (url) await injectAndAnalyze(url);
  });

  document.getElementById('btnGo').addEventListener('click', async () => {
    const url = document.getElementById('urlInput').value.trim();
    if (url) await injectAndAnalyze(url);
  });

  document.getElementById('urlInput').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const url = e.target.value.trim();
      if (url) await injectAndAnalyze(url);
    }
  });
}

// ── Inject overlay and trigger analysis ──────────────────────────────────────
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

    window.close(); // close popup so overlay is visible
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

function truncateUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.slice(0, 28);
  } catch {
    return url.slice(0, 45);
  }
}
