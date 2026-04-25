import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import type { FramePoint, AudioResult } from '../store'

// ── Animated confidence arc ───────────────────────────────────────────────────
function ConfidenceArc({ pct, isFake }: { pct: number; isFake: boolean }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const half = circ / 2
  const fill = (pct / 100) * half
  const color = isFake ? '#ff3355' : '#00ff88'

  return (
    <div className="relative w-40 h-20 mx-auto">
      <svg width="160" height="80" viewBox="0 0 160 80">
        {/* Track */}
        <path
          d={`M 16 80 A ${r} ${r} 0 0 1 144 80`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round"
        />
        {/* Fill */}
        <motion.path
          d={`M 16 80 A ${r} ${r} 0 0 1 144 80`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${half} ${half}`}
          initial={{ strokeDashoffset: half }}
          animate={{ strokeDashoffset: half - fill }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <motion.span
          className="text-2xl font-bold font-mono"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {pct}%
        </motion.span>
      </div>
    </div>
  )
}

// ── Frame timeline ────────────────────────────────────────────────────────────
function Timeline({ frames, isFake }: { frames: FramePoint[]; isFake: boolean }) {
  if (!frames.length) return (
    <p className="text-white/30 text-xs font-mono text-center py-4">No per-frame data</p>
  )

  const color = isFake ? '#ff3355' : '#00ff88'
  const maxH = 60

  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: maxH + 24 + 'px', position: 'relative' }}>
      {/* 60% threshold line */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{ bottom: 24 + maxH * 0.6, height: 1, background: 'rgba(255,170,0,0.35)' }}
      >
        <span className="absolute right-0 -top-4 text-[9px] text-yellow-400/60 font-mono">60%</span>
      </div>

      {frames.map((pt, i) => {
        const h = Math.max(3, (pt.fake_pct / 100) * maxH)
        const hot = pt.fake_pct >= 60
        return (
          <div key={i} className="group relative flex-shrink-0" style={{ width: 10, height: maxH }}>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#0a0a14] border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              F{pt.frame}: {pt.fake_pct}%
            </div>
            <motion.div
              className="absolute bottom-0 w-full rounded-t"
              style={{
                background: hot
                  ? `linear-gradient(to top, ${color}, rgba(255,255,255,0.3))`
                  : 'rgba(255,255,255,0.1)',
                boxShadow: hot ? `0 0 6px ${color}66` : 'none',
              }}
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.6, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Audio card ────────────────────────────────────────────────────────────────
function AudioCard({ audio }: { audio: AudioResult }) {
  if (!audio?.available) return null

  const isAI = audio.result === 'AI_VOICE'
  const color = isAI ? '#ff3355' : '#00ff88'
  const colorDim = isAI ? 'rgba(255,51,85,0.12)' : 'rgba(0,255,136,0.12)'

  return (
    <motion.div
      className="rounded-2xl border p-5"
      style={{ borderColor: `${color}33`, background: colorDim }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full" style={{ background: '#00aaff', boxShadow: '0 0 8px #00aaff' }} />
        <span className="text-[10px] font-bold tracking-widest text-[#00aaff] uppercase">Voice Authenticity</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span
          className="px-3 py-1.5 rounded-full text-xs font-bold tracking-wider border"
          style={{ color, borderColor: `${color}55`, background: `${color}12` }}
        >
          {isAI ? '🤖 AI VOICE DETECTED' : '🎙️ HUMAN VOICE'}
        </span>
        <span className="text-2xl font-bold font-mono ml-auto" style={{ color }}>
          {audio.confidence}%
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-4">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: isAI ? 'linear-gradient(90deg,#880022,#ff3355)' : 'linear-gradient(90deg,#00aaff,#00ff88)',
            boxShadow: `0 0 10px ${color}66`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${audio.confidence}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Wav2Vec2 Model', val: `${audio.model_score}%` },
          { label: 'Signal Heuristics', val: `${audio.heuristic_score}%` },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-xl bg-white/3 border border-white/5 p-3 text-center">
            <p className="text-[10px] text-white/40 tracking-wider mb-1">{label}</p>
            <p className="text-lg font-bold font-mono text-white">{val}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="space-y-2">
        {audio.details.map((d, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-2.5 text-xs text-white/60 bg-white/2 rounded-lg px-3 py-2 border-l-2"
            style={{ borderLeftColor: color }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.07 }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            {d}
          </motion.div>
        ))}
      </div>

      {/* Features */}
      {audio.features && Object.keys(audio.features).length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-[10px] text-white/30 tracking-widest uppercase mb-2">Signal Features</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(audio.features).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-white/30 capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="text-white/70 font-mono">{typeof v === 'number' ? v.toFixed(3) : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Main result panel ─────────────────────────────────────────────────────────
export default function ResultPanel() {
  const { result, reset } = useStore()
  if (!result) return null

  const isFake = result.result === 'FAKE'
  const color = isFake ? '#ff3355' : '#00ff88'
  const colorDim = isFake ? 'rgba(255,51,85,0.08)' : 'rgba(0,255,136,0.08)'

  return (
    <AnimatePresence>
      <motion.div
        className="w-full max-w-2xl mx-auto space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Verdict card */}
        <motion.div
          className="rounded-2xl border-2 p-6"
          style={{ borderColor: `${color}55`, background: colorDim, boxShadow: `0 0 50px ${color}15` }}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="flex flex-wrap items-center gap-6">
            {/* Badge */}
            <div className="text-center flex-shrink-0">
              <motion.div
                className="w-24 h-24 rounded-full border-2 flex items-center justify-center mx-auto mb-3 text-4xl"
                style={{ borderColor: color, boxShadow: `0 0 30px ${color}44`, background: `${color}10` }}
                animate={{ boxShadow: [`0 0 20px ${color}30`, `0 0 50px ${color}60`, `0 0 20px ${color}30`] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isFake ? '⚠️' : '✅'}
              </motion.div>
              <motion.p
                className="text-2xl font-bold tracking-widest"
                style={{ color, textShadow: `0 0 20px ${color}66` }}
                animate={isFake ? { textShadow: [`0 0 10px ${color}44`, `0 0 25px ${color}88`, `0 0 10px ${color}44`] } : {}}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                {isFake ? 'DEEPFAKE' : 'AUTHENTIC'}
              </motion.p>
              <p className="text-[10px] text-white/30 tracking-widest mt-1">VERDICT</p>
            </div>

            {/* Confidence */}
            <div className="flex-1 min-w-[200px]">
              <p className="text-[10px] text-white/40 tracking-widest uppercase mb-3">Confidence Score</p>
              <ConfidenceArc pct={result.confidence} isFake={isFake} />

              {/* Risk pill */}
              <div className="mt-4 flex items-center justify-between bg-white/3 rounded-xl px-4 py-3 border border-white/5">
                <span className="text-[10px] text-white/40 tracking-wider uppercase">Risk Level</span>
                <span
                  className="text-xs font-bold tracking-wider px-3 py-1 rounded-full border"
                  style={{
                    color: result.confidence < 35 ? '#00ff88' : result.confidence < 65 ? '#ffaa00' : '#ff3355',
                    borderColor: result.confidence < 35 ? '#00ff8844' : result.confidence < 65 ? '#ffaa0044' : '#ff335544',
                    background: result.confidence < 35 ? '#00ff8810' : result.confidence < 65 ? '#ffaa0010' : '#ff335510',
                  }}
                >
                  {result.confidence < 35 ? 'LOW' : result.confidence < 65 ? 'MEDIUM' : result.confidence < 80 ? 'HIGH' : 'CRITICAL'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Insights + Meta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Insights */}
          <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-4 rounded-full bg-[#00aaff] shadow-[0_0_8px_#00aaff]" />
              <span className="text-[10px] font-bold tracking-widest text-[#00aaff] uppercase">Analysis Insights</span>
            </div>
            <div className="space-y-2">
              {result.details.map((d, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-2.5 text-xs text-white/60 bg-white/2 rounded-lg px-3 py-2.5 border-l-2"
                  style={{ borderLeftColor: color }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
                  {d}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-4 rounded-full bg-[#00aaff] shadow-[0_0_8px_#00aaff]" />
              <span className="text-[10px] font-bold tracking-widest text-[#00aaff] uppercase">Video Metadata</span>
            </div>
            <div className="space-y-2.5">
              {[
                ['Frames Analyzed', result.metadata.frames_analyzed],
                ['Faces Detected', result.metadata.frames_with_faces],
                ['Duration', `${result.metadata.video_duration_sec}s`],
                ['FPS', result.metadata.video_fps],
                ['Resolution', result.metadata.resolution],
                ['Processing Time', `${result.processing_time_sec}s`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between items-center border-b border-white/4 pb-2 last:border-0 last:pb-0">
                  <span className="text-[11px] text-white/40">{k}</span>
                  <span className="text-[12px] font-bold font-mono text-white">{v ?? '—'}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_6px_#00ff88]" />
              <span className="text-[10px] text-white/30 font-mono tracking-wider">ViT Ensemble · 2 Models</span>
            </div>
          </div>
        </div>

        {/* Frame Timeline */}
        <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-0.5 h-4 rounded-full bg-[#00aaff] shadow-[0_0_8px_#00aaff]" />
            <span className="text-[10px] font-bold tracking-widest text-[#00aaff] uppercase">Frame Analysis Timeline</span>
            <span className="text-[10px] text-white/20 font-mono ml-1">— {result.frame_timeline.length} frames</span>
          </div>
          <Timeline frames={result.frame_timeline} isFake={isFake} />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-white/20 font-mono">Frame 0</span>
            <span className="text-[10px] text-white/20 font-mono">Frame {result.frame_timeline.length}</span>
          </div>
        </div>

        {/* Audio */}
        {result.audio && <AudioCard audio={result.audio} />}

        {/* Reset */}
        <div className="text-center pt-2">
          <motion.button
            onClick={reset}
            className="px-6 py-2.5 text-xs font-bold tracking-widest uppercase text-white/40 border border-white/10 rounded-xl hover:text-[#00ff88] hover:border-[#00ff8840] hover:bg-[#00ff8808] transition-all duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ↻ &nbsp;Analyze Another Video
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
