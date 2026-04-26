import { useEffect, useRef } from 'react';
import type { AnalysisResult } from '../types';

interface ResultSectionProps {
  result: AnalysisResult;
  onReset: () => void;
}

function fmtVal(v: unknown) {
  if (v === null || v === undefined) return '—';
  return String(v);
}

// Neumorphic card style — dark purple variant
const neuCard: React.CSSProperties = {
  borderRadius: 30,
  background: '#120a24',
  boxShadow: '15px 15px 30px #0a0618, -15px -15px 30px #1a0e30',
};

const neuCardAccent = (color: string): React.CSSProperties => ({
  borderRadius: 30,
  background: '#120a24',
  boxShadow: `15px 15px 30px #0a0618, -15px -15px 30px #1a0e30, 0 0 0 1px ${color}22`,
});

export default function ResultSection({ result, onReset }: ResultSectionProps) {
  const isFake = result.result === 'FAKE';
  const pct = result.confidence;
  const accentColor = isFake ? '#ff3355' : '#a855f7';
  const accentGlow  = isFake ? 'rgba(255,51,85,0.4)' : 'rgba(168,85,247,0.4)';
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;
    container.innerHTML = '';

    const frames = result.frame_timeline ?? [];
    if (!frames.length) {
      container.innerHTML = '<span style="font-size:11px;color:#6b21a8;font-family:Space Grotesk,monospace;margin:auto;display:flex;align-items:center;height:100%;">No per-frame data available</span>';
      return;
    }

    const W = container.clientWidth || 600;
    const H = 120;
    const PAD = { top: 12, right: 16, bottom: 24, left: 32 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    const scores = frames.map(f => f.fake_pct / 100);
    const n = scores.length;

    // x/y helpers
    const xOf = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * chartW;
    const yOf = (v: number) => PAD.top + (1 - v) * chartH;

    // Smooth catmull-rom path
    const smooth = (pts: [number, number][]) => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
      }
      return d;
    };

    const pts: [number, number][] = scores.map((v, i) => [xOf(i), yOf(v)]);
    const linePath = smooth(pts);
    const areaPath = linePath
      + ` L ${xOf(n - 1)},${yOf(0)} L ${xOf(0)},${yOf(0)} Z`;

    const gradId = `tl-grad-${Date.now()}`;
    const fakeColor = isFake ? '#ff3355' : '#a855f7';
    const fakeColorMid = isFake ? 'rgba(255,51,85,0.35)' : 'rgba(168,85,247,0.35)';
    const fakeColorEnd = isFake ? 'rgba(255,51,85,0.0)' : 'rgba(168,85,247,0.0)';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(H));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.overflow = 'visible';

    // Defs: gradient + glow filter
    svg.innerHTML = `
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${fakeColor}" stop-opacity="0.55"/>
          <stop offset="60%" stop-color="${fakeColorMid}"/>
          <stop offset="100%" stop-color="${fakeColorEnd}"/>
        </linearGradient>
        <filter id="glow-${gradId}">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Grid lines -->
      ${[0, 0.25, 0.5, 0.75, 1].map(v => `
        <line
          x1="${PAD.left}" y1="${yOf(v)}"
          x2="${PAD.left + chartW}" y2="${yOf(v)}"
          stroke="rgba(88,28,135,0.25)" stroke-width="1"
          stroke-dasharray="${v === 0.5 ? '4,3' : '2,4'}"
        />
        <text x="${PAD.left - 6}" y="${yOf(v) + 4}"
          font-size="9" fill="rgba(168,85,247,0.4)"
          text-anchor="end" font-family="Space Grotesk,monospace">
          ${Math.round(v * 100)}%
        </text>
      `).join('')}

      <!-- 50% threshold label -->
      <text x="${PAD.left + chartW + 4}" y="${yOf(0.5) + 4}"
        font-size="9" fill="rgba(168,85,247,0.6)"
        font-family="Space Grotesk,monospace" font-weight="700">50%</text>

      <!-- Area fill -->
      <path d="${areaPath}" fill="url(#${gradId})"/>

      <!-- Line -->
      <path d="${linePath}"
        fill="none" stroke="${fakeColor}" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"
        filter="url(#glow-${gradId})"/>

      <!-- Data points -->
      ${scores.map((v, i) => {
        const x = xOf(i);
        const y = yOf(v);
        const hot = v > 0.5;
        return `
          <circle cx="${x}" cy="${y}" r="${hot ? 4 : 2.5}"
            fill="${hot ? fakeColor : '#120a24'}"
            stroke="${fakeColor}" stroke-width="${hot ? 0 : 1.5}"
            opacity="${hot ? 1 : 0.6}"
            filter="${hot ? `url(#glow-${gradId})` : ''}"/>
        `;
      }).join('')}

      <!-- X-axis frame labels (every ~5th) -->
      ${scores.map((_, i) => {
        if (i % Math.max(1, Math.floor(n / 8)) !== 0 && i !== n - 1) return '';
        return `<text x="${xOf(i)}" y="${H - 4}"
          font-size="8" fill="rgba(168,85,247,0.35)"
          text-anchor="middle" font-family="Space Grotesk,monospace">F${i + 1}</text>`;
      }).join('')}
    `;

    container.appendChild(svg);
  }, [result, isFake]);

  const metaItems = [
    ['Frames Analyzed', fmtVal(result.metadata?.frames_analyzed)],
    ['Duration',        result.metadata?.video_duration_sec ? result.metadata.video_duration_sec + 's' : '—'],
    ['FPS',             fmtVal(result.metadata?.video_fps)],
    ['Resolution',      fmtVal(result.metadata?.resolution)],
    ['Processing Time', result.processing_time_sec ? result.processing_time_sec + 's' : '—'],
  ];

  const audioLabel: Record<string, string> = {
    HUMAN_VOICE: 'Human Voice',
    AI_VOICE: 'AI Voice',
    AV_MISMATCH: 'AV Mismatch',
    NO_AUDIO: 'No Audio',
  };

  return (
    <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-28 pb-16 min-h-screen">
      <div className="w-full max-w-4xl flex flex-col gap-6">

        {/* ── Verdict card ── */}
        <div style={neuCardAccent(accentColor)} className="p-8 overflow-hidden relative">
          <div className="flex flex-col md:flex-row items-center gap-8">

            {/* Badge */}
            <div
              className="flex flex-col items-center justify-center w-40 h-40 rounded-full flex-shrink-0"
              style={{
                background: '#120a24',
                boxShadow: `8px 8px 20px #0a0618, -8px -8px 20px #1a0e30, 0 0 0 2px ${accentColor}55, 0 0 30px ${accentGlow}`,
              }}
            >
              <span className="text-4xl mb-1">{isFake ? '⚠' : '✓'}</span>
              <span className="text-xl font-black tracking-widest uppercase"
                style={{ color: accentColor, textShadow: `0 0 20px ${accentGlow}` }}>
                {isFake ? 'DEEPFAKE' : 'AUTHENTIC'}
              </span>
            </div>

            {/* Confidence */}
            <div className="flex-1 w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-[10px] tracking-widest uppercase text-purple-400/40">
                  Confidence Score
                </span>
                <span className="text-2xl font-black" style={{ color: accentColor }}>
                  {pct}%
                </span>
              </div>

              {/* Bar track — inset neumorphic */}
              <div className="w-full h-4 rounded-full overflow-hidden mb-4"
                style={{
                  background: '#120a24',
                  boxShadow: 'inset 4px 4px 8px #0a0618, inset -4px -4px 8px #1a0e30',
                }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${pct}%`,
                    background: isFake
                      ? 'linear-gradient(to right, #ff3355, #ff6680)'
                      : 'linear-gradient(to right, #7c3aed, #a855f7, #c084fc)',
                    boxShadow: `0 0 12px ${accentGlow}`,
                  }}
                />
              </div>

              {/* Risk badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{
                  color: pct >= 65 ? '#ff3355' : pct >= 35 ? '#f59e0b' : '#a855f7',
                  background: '#120a24',
                  boxShadow: `4px 4px 10px #0a0618, -4px -4px 10px #1a0e30`,
                  border: `1px solid ${pct >= 65 ? 'rgba(255,51,85,0.3)' : pct >= 35 ? 'rgba(245,158,11,0.3)' : 'rgba(168,85,247,0.3)'}`,
                }}>
                {pct >= 65 ? 'CRITICAL RISK' : pct >= 35 ? 'MEDIUM RISK' : 'LOW RISK'}
              </div>

              {result.audio?.available && (
                <div className="mt-3 flex items-center gap-3 text-xs text-purple-300/50">
                  <span className="material-symbols-outlined text-[16px]">
                    {result.audio.result === 'HUMAN_VOICE' ? 'mic' : result.audio.result === 'AI_VOICE' ? 'smart_toy' : 'warning'}
                  </span>
                  <span>Audio: <strong style={{ color: accentColor }}>{audioLabel[result.audio.result] ?? result.audio.result}</strong></span>
                  <span className="text-purple-500/40">({result.audio.confidence?.toFixed(1)}% conf)</span>
                </div>
              )}

              {result.metadata_check?.c2pa_detected && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-400/70">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  C2PA metadata detected — AI-generated content signature found
                  {result.metadata_check.tool_detected && (
                    <span className="text-purple-400/40">({result.metadata_check.tool_detected})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Insights + Metadata row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Insights */}
          <div style={neuCard} className="p-6">
            <h3 className="font-bold text-[10px] tracking-widest uppercase mb-4 flex items-center gap-2 text-purple-400/40">
              <span className="material-symbols-outlined text-[14px]">analytics</span>
              Analysis Insights
            </h3>
            <div className="flex flex-col gap-3">
              {(result.details ?? ['Analysis completed.']).map((txt, i) => (
                <div key={i} className="flex items-start gap-3 pl-3 text-sm text-purple-100/70"
                  style={{ borderLeft: `2px solid ${accentColor}` }}>
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: accentColor, boxShadow: `0 0 8px ${accentGlow}` }} />
                  {txt}
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div style={neuCard} className="p-6">
            <h3 className="font-bold text-[10px] tracking-widest uppercase mb-4 flex items-center gap-2 text-purple-400/40">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Video Metadata
            </h3>
            <div className="flex flex-col gap-3">
              {metaItems.map(([k, v]) => (
                <div key={k} className="flex justify-between items-center pb-2"
                  style={{ borderBottom: '1px solid rgba(88,28,135,0.2)' }}>
                  <span className="text-[11px] tracking-wider uppercase text-purple-400/40">{k}</span>
                  <span className="text-sm font-bold text-white font-mono">{v}</span>
                </div>
              ))}
              {result.cached && (
                <div className="flex items-center gap-2 text-xs text-purple-400/60 mt-1">
                  <span className="material-symbols-outlined text-[14px]">cached</span>
                  Result served from cache
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Frame timeline ── */}
        <div style={neuCard} className="p-6">
          <h3 className="font-bold text-[10px] tracking-widest uppercase mb-4 flex items-center gap-2 text-purple-400/40">
            <span className="material-symbols-outlined text-[14px]">timeline</span>
            Frame-by-Frame Analysis
          </h3>
          <div ref={timelineRef} className="relative w-full" style={{ height: 120 }} />
        </div>

        {/* ── Action button ── */}
        <div className="flex justify-center">
          <button
            onClick={onReset}
            className="px-8 py-3 font-bold text-xs uppercase tracking-wider rounded-full transition-all active:scale-95"
            style={{
              background: '#120a24',
              boxShadow: '8px 8px 16px #0a0618, -8px -8px 16px #1a0e30',
              border: '1px solid rgba(168,85,247,0.3)',
              color: '#c084fc',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '8px 8px 16px #0a0618, -8px -8px 16px #1a0e30, 0 0 20px rgba(168,85,247,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '8px 8px 16px #0a0618, -8px -8px 16px #1a0e30')}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Analyze Another
            </span>
          </button>
        </div>

      </div>
    </section>
  );
}
