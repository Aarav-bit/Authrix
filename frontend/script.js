/**
 * Deepfake Authenticator — Frontend Logic (Cinematic Dark UI)
 */

const API_BASE = (window.location.protocol === 'file:')
  ? 'http://localhost:8000'
  : window.location.origin;

let selectedFile = null;

// ── Boot ──────────────────────────────────────
window.addEventListener('load', () => {
  initUpload();
});

// ── Upload wiring ─────────────────────────────
function initUpload() {
  const zone  = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');
  const clear = document.getElementById('clearBtn');
  const btn   = document.getElementById('analyzeBtn');

  zone.addEventListener('click', e => {
    if (!e.target.closest('#clearBtn')) input.click();
  });

  input.addEventListener('change', () => {
    if (input.files?.[0]) applyFile(input.files[0]);
  });

  clear.addEventListener('click', e => {
    e.stopPropagation();
    clearFile();
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('video/')) applyFile(f);
    else showError('Please drop a valid video file (MP4, AVI, MOV, MKV, WebM).');
  });

  btn.addEventListener('click', analyzeVideo);
}

function applyFile(file) {
  selectedFile = file;
  document.getElementById('uploadPrompt').classList.add('hidden');
  const fc = document.getElementById('fileChosen');
  fc.classList.remove('hidden');
  document.getElementById('chosenName').textContent = file.name;
  document.getElementById('chosenSize').textContent = fmtBytes(file.size);
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = false;
  btn.classList.add('active');
}

function clearFile() {
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('fileChosen').classList.add('hidden');
  document.getElementById('uploadPrompt').classList.remove('hidden');
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.classList.remove('active');
}

function resetAll() {
  clearFile();
  ['loadingSection', 'resultSection', 'errorSection'].forEach(hide);
  show('uploadSection');
}

// ── Analyze ───────────────────────────────────
async function analyzeVideo() {
  if (!selectedFile) return;

  hide('uploadSection');
  show('loadingSection');
  ['resultSection', 'errorSection'].forEach(hide);

  startAgentAnim();

  const fd = new FormData();
  fd.append('file', selectedFile);

  try {
    const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || `Server error ${res.status}`);
    }
    const data = await res.json();
    renderResult(data);
  } catch (err) {
    showError(err.message || 'Connection to analysis engine failed.');
  } finally {
    hide('loadingSection');
    stopAgentAnim();
  }
}

// ── Loading Animation ─────────────────────────
let _simTimer = null;
let _agentTimer = null;

function startAgentAnim() {
  const statusEl = document.getElementById('loadingStatus');
  const progBar  = document.getElementById('progressBar');

  const phases = [
    { p: 12,  msg: 'Extracting keyframes...', ag: 0 },
    { p: 35,  msg: 'Isolating facial regions...', ag: 1 },
    { p: 65,  msg: 'Running ViT neural inference...', ag: 2 },
    { p: 85,  msg: 'Cross-referencing metadata...', ag: 2 },
    { p: 95,  msg: 'Compiling authenticity report...', ag: 3 },
  ];

  // Reset agents
  [0,1,2,3].forEach(i => {
    const card = document.getElementById('ag' + i);
    if (card) card.classList.remove('active');
  });

  statusEl.textContent = 'Initializing sequence...';
  progBar.style.width = '0%';

  let idx = 0;
  _simTimer = setInterval(() => {
    if (idx < phases.length) {
      const ph = phases[idx];
      statusEl.textContent = ph.msg;
      progBar.style.width = ph.p + '%';
      const card = document.getElementById('ag' + ph.ag);
      if (card) card.classList.add('active');
      idx++;
    }
  }, 1100);
}

function stopAgentAnim() {
  if (_simTimer) { clearInterval(_simTimer); _simTimer = null; }
  document.getElementById('progressBar').style.width = '100%';
  [0,1,2,3].forEach(i => {
    const card = document.getElementById('ag' + i);
    if (card) card.classList.add('active');
  });
}

// ── Render Result ─────────────────────────────
function renderResult(data) {
  const isFake = data.result === 'FAKE';
  const pct    = data.confidence;

  // Verdict card border glow
  const vc = document.getElementById('verdictCard');
  vc.style.borderColor = isFake ? 'rgba(255,51,85,0.5)' : 'rgba(0,255,136,0.5)';
  vc.style.boxShadow   = isFake
    ? '0 0 50px rgba(255,51,85,0.15), inset 0 0 30px rgba(255,51,85,0.05)'
    : '0 0 50px rgba(0,255,136,0.15), inset 0 0 30px rgba(0,255,136,0.05)';

  // Badge
  const badge = document.getElementById('verdictBadge');
  badge.className = 'verdict-badge ' + (isFake ? 'fake' : 'real');
  badge.style.background = isFake ? 'rgba(255,51,85,0.08)' : 'rgba(0,255,136,0.08)';

  // Emoji
  document.getElementById('verdictEmoji').textContent = isFake ? '⚠' : '✓';

  // Label
  const lbl = document.getElementById('verdictLabel');
  lbl.textContent = isFake ? 'DEEPFAKE' : 'AUTHENTIC';
  lbl.style.color = isFake ? '#ff3355' : '#00ff88';
  lbl.style.textShadow = isFake
    ? '0 0 20px rgba(255,51,85,0.7)'
    : '0 0 20px rgba(0,255,136,0.7)';
  if (isFake) lbl.classList.add('glitch-text');
  else lbl.classList.remove('glitch-text');

  // Confidence value
  const cv = document.getElementById('confValue');
  cv.textContent = pct + '%';
  cv.style.color = isFake ? '#ff3355' : '#00ff88';

  // Confidence bar
  const bar = document.getElementById('confBar');
  bar.className = 'conf-fill ' + (isFake ? 'fake' : 'real');
  setTimeout(() => { bar.style.width = pct + '%'; }, 80);

  // Risk needle
  const needle = document.getElementById('riskNeedle');
  const riskLbl = document.getElementById('riskLabel');
  if (pct < 35) {
    needle.textContent = 'LOW RISK';
    needle.style.color = '#00ff88';
    needle.style.borderColor = 'rgba(0,255,136,0.35)';
    needle.style.background = 'rgba(0,255,136,0.08)';
    if (riskLbl) riskLbl.textContent = 'Minimal manipulation indicators detected';
  } else if (pct < 65) {
    needle.textContent = 'MEDIUM RISK';
    needle.style.color = '#ffaa00';
    needle.style.borderColor = 'rgba(255,170,0,0.35)';
    needle.style.background = 'rgba(255,170,0,0.08)';
    if (riskLbl) riskLbl.textContent = 'Moderate anomalies detected — review advised';
  } else {
    needle.textContent = 'CRITICAL RISK';
    needle.style.color = '#ff3355';
    needle.style.borderColor = 'rgba(255,51,85,0.35)';
    needle.style.background = 'rgba(255,51,85,0.08)';
    if (riskLbl) riskLbl.textContent = 'High-confidence manipulation signatures found';
  }

  // Insights
  const dl = document.getElementById('detailsList');
  dl.innerHTML = '';
  const details = data.details || ['Analysis completed successfully.'];
  const dotColor = isFake ? '#ff3355' : '#00ff88';
  const dotGlow  = isFake ? 'rgba(255,51,85,0.6)' : 'rgba(0,255,136,0.6)';
  details.forEach((txt, i) => {
    const div = document.createElement('div');
    div.className = 'insight-item';
    div.style.animationDelay = (i * 0.08) + 's';
    div.style.borderLeftColor = dotColor;
    div.style.borderLeft = `2px solid ${dotColor}`;
    div.innerHTML = `<span class="insight-dot" style="background:${dotColor};box-shadow:0 0 8px ${dotGlow};"></span><span>${esc(txt)}</span>`;
    dl.appendChild(div);
  });

  // Metadata
  const meta = data.metadata || {};
  const mg = document.getElementById('metaGrid');
  mg.innerHTML = '';
  const metaItems = [
    ['Frames Analyzed', meta.frames_analyzed ?? '—'],
    ['Duration',        meta.video_duration_sec ? meta.video_duration_sec + 's' : '—'],
    ['FPS',             meta.video_fps ?? '—'],
    ['Resolution',      meta.resolution ?? '—'],
    ['Processing Time', data.processing_time_sec ? data.processing_time_sec + 's' : '—'],
  ];
  metaItems.forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'meta-row';
    row.innerHTML = `<span style="font-size:11px;color:var(--muted);letter-spacing:0.08em;">${k}</span><span style="font-size:13px;font-weight:600;color:#fff;font-family:'JetBrains Mono',monospace;">${v}</span>`;
    mg.appendChild(row);
  });

  // Frame timeline
  renderTimeline(data, isFake);

  show('resultSection');
}

function renderTimeline(data, isFake) {
  const chart = document.getElementById('timelineChart');
  if (!chart) return;
  chart.innerHTML = '';

  const frames = data.frame_scores || [];
  if (!frames.length) {
    chart.innerHTML = '<span style="font-size:11px;color:var(--muted);font-family:\'JetBrains Mono\',monospace;margin:auto;">No per-frame data available</span>';
    return;
  }

  const maxH = 60; // px
  const barColor = isFake ? '#ff3355' : '#00ff88';
  const barGlow  = isFake ? 'rgba(255,51,85,0.5)' : 'rgba(0,255,136,0.5)';

  frames.forEach((score, i) => {
    const pct = Math.round(score * 100);
    const h   = Math.max(4, Math.round((score) * maxH));

    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap';
    wrap.style.height = maxH + 'px';

    const outer = document.createElement('div');
    outer.className = 'bar-outer';
    outer.style.height = maxH + 'px';

    const inner = document.createElement('div');
    inner.className = 'bar-inner';
    inner.style.height = '0px';
    inner.style.background = score > 0.5
      ? `linear-gradient(to top, ${barColor}, rgba(255,255,255,0.3))`
      : 'rgba(255,255,255,0.12)';
    if (score > 0.5) inner.style.boxShadow = `0 0 8px ${barGlow}`;

    outer.appendChild(inner);

    const tip = document.createElement('div');
    tip.className = 'bar-tooltip';
    tip.textContent = `F${i+1}: ${pct}%`;

    wrap.appendChild(outer);
    wrap.appendChild(tip);
    chart.appendChild(wrap);

    // Animate in
    setTimeout(() => { inner.style.height = h + 'px'; }, 50 + i * 20);
  });

  // Threshold line at 50%
  const line = document.createElement('div');
  line.style.cssText = `position:absolute;left:0;right:0;bottom:${maxH*0.5}px;height:1px;background:rgba(255,170,0,0.4);pointer-events:none;`;
  const lineLbl = document.createElement('span');
  lineLbl.style.cssText = 'position:absolute;right:4px;top:-14px;font-size:9px;color:#ffaa00;font-family:\'JetBrains Mono\',monospace;letter-spacing:0.1em;';
  lineLbl.textContent = '50%';
  line.appendChild(lineLbl);
  chart.appendChild(line);
}

// ── Helpers ───────────────────────────────────
function show(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  if (el.style.display === 'none') el.style.display = '';
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function fmtBytes(b) {
  if (b < 1024)    return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showError(msg) {
  hide('uploadSection');
  hide('loadingSection');
  document.getElementById('errorMsg').textContent = msg;
  show('errorSection');
}
