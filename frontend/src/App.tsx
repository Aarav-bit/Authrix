import { useEffect, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from './store'
import { checkHealth } from './api'
import UploadZone from './components/UploadZone'
import ResultPanel from './components/ResultPanel'

// Lazy-load the heavy 3D component
const DeepfakeOrb = lazy(() => import('./components/DeepfakeOrb'))

export default function App() {
  const { state, result, error, reset } = useStore()
  const verdict = result?.result ?? null

  // Health check on mount
  useEffect(() => {
    const badge = document.getElementById('modelBadge')
    checkHealth()
      .then((d) => {
        if (badge) {
          badge.textContent = d.model.toUpperCase()
          badge.style.color = '#00ff88bb'
          badge.style.borderColor = '#00ff8844'
        }
      })
      .catch(() => {
        if (badge) {
          badge.textContent = 'SERVER OFFLINE'
          badge.style.color = '#ff3355bb'
          badge.style.borderColor = '#ff335544'
        }
      })
  }, [])

  const showUpload = state === 'idle' || state === 'loading'
  const showResult = state === 'result'
  const showError  = state === 'error'

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#050508' }}>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-9 h-9 rounded-lg border border-[#00ff8855] flex items-center justify-center"
              animate={{ boxShadow: ['0 0 8px #00ff8820', '0 0 20px #00ff8840', '0 0 8px #00ff8820'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <svg width="18" height="18" fill="none" stroke="#00ff88" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </motion.div>
            <div>
              <p className="text-sm font-bold tracking-widest" style={{ color: '#00ff88', textShadow: '0 0 12px #00ff8855' }}>
                DEEPFAKE AUTHENTICATOR
              </p>
              <p className="text-[9px] tracking-widest text-white/30 font-mono">AI-POWERED VIDEO FORENSICS</p>
            </div>
          </div>
          <div
            id="modelBadge"
            className="text-[10px] px-3 py-1.5 rounded-full border font-mono tracking-wider transition-all duration-500"
            style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}
          >
            CONNECTING...
          </div>
        </div>
      </header>

      {/* ── Main layout ── */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-10 items-start">

          {/* ── Left: 3D orb + hero ── */}
          <div className="w-full lg:w-80 flex-shrink-0 flex flex-col items-center gap-6 lg:sticky lg:top-24">
            {/* 3D Orb */}
            <div className="w-64 h-64 relative">
              <Suspense fallback={
                <div className="w-full h-full rounded-full border border-[#00ff8830] flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-2 border-[#00ff88] border-t-transparent animate-spin" />
                </div>
              }>
                <DeepfakeOrb state={state} verdict={verdict} />
              </Suspense>
            </div>

            {/* Hero text */}
            <AnimatePresence mode="wait">
              {showUpload && (
                <motion.div
                  key="hero"
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <h1 className="text-2xl font-bold mb-2 leading-tight"
                    style={{ background: 'linear-gradient(135deg, #fff 30%, #00ff88)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Is This Video Real?
                  </h1>
                  <p className="text-white/40 text-xs leading-relaxed max-w-xs">
                    Dual ViT ensemble + Wav2Vec2 audio analysis detects facial manipulation and AI-generated voices.
                  </p>
                  {/* Stat pills */}
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {['2 ViT Models', '40 Frames', 'Audio AI', '< 20s'].map((s) => (
                      <span key={s} className="text-[10px] px-2.5 py-1 rounded-full border border-white/8 text-white/40 bg-white/3">
                        {s}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

              {showResult && verdict && (
                <motion.div
                  key="verdict-summary"
                  className="text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="text-3xl font-bold tracking-widest mb-1"
                    style={{ color: verdict === 'FAKE' ? '#ff3355' : '#00ff88', textShadow: `0 0 20px ${verdict === 'FAKE' ? '#ff335566' : '#00ff8866'}` }}>
                    {verdict === 'FAKE' ? 'DEEPFAKE' : 'AUTHENTIC'}
                  </p>
                  <p className="text-white/30 text-xs font-mono">{result?.confidence}% confidence</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right: Upload / Result / Error ── */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {showUpload && (
                <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <UploadZone />
                </motion.div>
              )}

              {showResult && (
                <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <ResultPanel />
                </motion.div>
              )}

              {showError && (
                <motion.div
                  key="error"
                  className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">⚠️</span>
                    <span className="text-red-400 font-bold text-sm tracking-wider uppercase">Analysis Failed</span>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">{error}</p>
                  <button
                    onClick={reset}
                    className="mt-4 text-xs text-white/30 hover:text-white transition-colors font-mono tracking-wider"
                  >
                    ↻ Try again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className="text-center py-8 text-[10px] text-white/15 font-mono tracking-widest border-t border-white/3">
        DEEPFAKE AUTHENTICATOR · MEDIAPIPE + VIT ENSEMBLE + WAV2VEC2 · LOCAL INFERENCE
      </footer>
    </div>
  )
}
