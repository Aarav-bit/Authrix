/**
 * Deepfake Authenticator — Frontend Logic
 */

const API_BASE = (window.location.protocol === 'file:')
  ? 'http://localhost:8000'
  : window.location.origin;

let selectedFile = null;

// ── Boot ──────────────────────────────────────
window.addEventListener('load', () => {
  initUpload();
  pingHealth();
});

// ── Health ────────────────────────────────────
async function pingHealth() {
  const badge = document.getElementById('modelBadge');
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(`${API_BASE}/health`);
      if (r.ok) {
        const d = await r.json();
        if (d.ready) {
          badge.textContent = d.model.toUpperCase();
          badge.classList.add('ready');
          return;
        }
      }
    } catch (_) {}
    badge.textContent = `CONNECTING ${i + 1}/8...`;
    await sleep(2000);
  }
  badge.textContent = 'SERVER OFFLINE';
  badge.style.borderColor = '#ff444444';
  badge.style.color = '#ff4444aa';
}

// ── Upload wiring ─────────────────────────────
function initUpload() {
  const zone  = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');
  const clear = document.getElementById('clearBtn');

  zone.addEventListener('click', e => {
    if (!e.target.closest('#clearBtn')) input.click();
  });
  input.addEventListener('change', () => {
    if (input.files?.[0]) applyFile(input.files[0]);
  });
  clear.addEventListener('click', e => { e.stopPropagation(); clearFile(); });

  zone.addEventListener('dragover',  e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('video/')) applyFile(f);
    else showError('Please drop a valid video file (MP4, AVI, MOV, MKV, WebM).');
  });
}

function applyFile(file) {
  selectedFile = file;
  document.getElementById('uploadPrompt').classList.add('hidden');
  const fc = document.getElementById('fileChosen');
  fc.classList.remove('hidden');
  fc.style.display = 'flex';
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
  ['loadingSection','resultSection','errorSection'].forEach(hide);
}

// ── Analyze ───────────────────────────────────
async function analyzeVideo() {
  if (!selectedFile) return;

  show('loadingSection');
  ['resultSection','errorSection'].forEach(hide);
  document.getElementById('analyzeBtn').disabled = true;

  startAgentAnim();

  const fd = new FormData();
  fd.append('file', selectedFile);

  try {
    const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || `Server error ${res.status}`);
    }
    renderResult(await res.json());
  } catch (err) {
    showError(err.message || 'Unknown error. Is the server running at ' + API_BASE + '?');
  } finally {
    hide('loadingSection');
    stopAgentAnim();
    document.getElementById('analyzeBtn').disabled = false;
  }
}

// ── Agent animation ───────────────────────────
const STEPS = [
  { id:'ag0', label:'Extracting frames...',  prog:12 },
  { id:'ag1', label:'Detecting faces...',    prog:38 },
  { id:'ag2', label:'Running AI ensemble...', prog:78 },
  { id:'ag3', label:'Generating report...',  prog:94 },
];
const _timers = [];

function startAgentAnim() {
  const delays = [0, 1600, 4200, 7500];
  STEPS.forEach((s, i) => {
    _timers.push(setTimeout(() => {
      const c = document.getElementById(s.id);
      if (!c) return;
      c.classList.add('active');
      c.querySelector('.a-status').textContent = s.label;
      document.getElementById('progressBar').style.width = s.prog + '%';
      document.getElementById('loadingStatus').textContent = s.label.toUpperCase();
    }, delays[i]));
  });
}

function stopAgentAnim() {
  _timers.forEach(clearTimeout); _timers.length = 0;
  STEPS.forEach(s => {
    const c = document.getElementById(s.id);
    if (!c) return;
    c.classList.remove('active');
    c.querySelector('.a-status').textContent = 'Waiting...';
  });
  document.getElementById('progressBar').style.width = '0%';
}

// ── Render result ─────────────────────────────
function renderResult(data) {
  const fake = data.result === 'FAKE';
  const pct  = data.confidence;

  // Verdict card
  const vc = document.getElementById('verdictCard');
  vc.className = 'fade-up ' + (fake ? 'fake' : 'real');

  // Badge
  const badge = document.getElementById('verdictBadge');
  badge.className = 'verdict-badge ' + (fake ? 'fake' : 'real');
  document.getElementById('verdictEmoji').textContent = fake ? '⚠️' : '✅';

  // Label
  const lbl = document.getElementById('verdictLabel');
  lbl.textContent = data.result;
  lbl.style.color = fake ? 'var(--red)' : 'var(--neon)';
  lbl.style.textShadow = fake ? '0 0 20px #ff444466' : '0 0 20px #00ff8866';

  // Confidence
  document.getElementById('confValue').textContent = pct + '%';
  document.getElementById('confValue').style.color = fake ? 'var(--red)' : 'var(--neon)';
  const bar = document.getElementById('confBar');
  bar.className = 'conf-fill ' + (fake ? 'fake' : 'real');
  setTimeout(() => { bar.style.width = pct + '%'; }, 80);

  // Risk needle
  const needle = document.getElementById('riskNeedle');
  const riskLbl = document.getElementById('riskLabel');
  setTimeout(() => { needle.style.left = pct + '%'; }, 80);
  if (pct < 35) {
    riskLbl.textContent = 'LOW'; riskLbl.style.color = 'var(--neon)';
  } else if (pct < 60) {
    riskLbl.textContent = 'MEDIUM'; riskLbl.style.color = '#facc15';
  } else if (pct < 80) {
    riskLbl.textContent = 'HIGH'; riskLbl.style.color = '#f97316';
  } else {
    riskLbl.textContent = 'CRITICAL'; riskLbl.style.color = 'var(--red)';
  }

  // Insights
  const dl = document.getElementById('detailsList');
  dl.innerHTML = '';
  (data.details || []).forEach((txt, i) => {
    const div = document.createElement('div');
    div.className = 'insight-item';
    div.style.animationDelay = (i * 60) + 'ms';
    div.innerHTML =
      `<span class="dot" style="background:${fake ? 'var(--red)' : 'var(--neon)'};
        box-shadow:0 0 6px ${fake ? '#ff444466' : '#00ff8866'};"></span>
       <span>${esc(txt)}</span>`;
    dl.appendChild(div);
  });

  // Metadata
  const meta = data.metadata || {};
  const mg = document.getElementById('metaGrid');
  mg.innerHTML = '';
  [
    ['Frames Analyzed',  meta.frames_analyzed  ?? '—'],
    ['Faces Detected',   meta.frames_with_faces ?? '—'],
    ['Duration',         meta.video_duration_sec ? meta.video_duration_sec + 's' : '—'],
    ['FPS',              meta.video_fps ?? '—'],
    ['Resolution',       meta.resolution ?? '—'],
    ['Processing Time',  data.processing_time_sec ? data.processing_time_sec + 's' : '—'],
  ].forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'meta-row';
    row.innerHTML = `<span class="meta-key">${k}</span><span class="meta-val">${v}</span>`;
    mg.appendChild(row);
  });

  // Timeline
  buildTimeline(data.frame_timeline || []);

  show('resultSection');
  document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Timeline ──────────────────────────────────
function buildTimeline(frames) {
  const chart = document.getElementById('timelineChart');
  chart.innerHTML = '';

  if (!frames.length) {
    chart.innerHTML = '<p style="font-size:11px;color:var(--muted);">No timeline data available</p>';
    return;
  }

  const maxH = 72;
  const threshold = 60;

  // Threshold line
  const line = document.createElement('div');
  line.className = 'threshold-line';
  line.style.bottom = ((threshold / 100) * maxH) + 'px';
  chart.appendChild(line);

  frames.forEach((pt, idx) => {
    const pct = pt.fake_pct;
    const h   = Math.max(4, (pct / 100) * maxH);
    const hot = pct >= threshold;

    const bar = document.createElement('div');
    bar.className = 't-bar';
    bar.style.height = h + 'px';
    bar.style.background = hot
      ? 'linear-gradient(to top, #ff2222, #ff6666)'
      : 'linear-gradient(to top, #00cc6a, #00ff88)';
    bar.style.boxShadow = hot ? '0 0 6px #ff444455' : '0 0 4px #00ff8844';
    bar.style.opacity = '0';
    bar.style.transition = 'opacity .3s ease, transform .2s ease';

    // Tooltip
    bar.innerHTML = `<div class="tooltip">Frame ${pt.frame}<br>${pct}% fake</div>`;

    chart.appendChild(bar);
    setTimeout(() => { bar.style.opacity = '1'; }, 30 + idx * 20);
  });
}

// ── Error ─────────────────────────────────────
function showError(msg) {
  hide('loadingSection');
  document.getElementById('errorMsg').textContent = msg;
  show('errorSection');
}

// ── Helpers ───────────────────────────────────
function show(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  el.style.display = '';
}
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
