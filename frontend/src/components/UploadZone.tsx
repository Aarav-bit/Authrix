import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'
import { analyzeVideo } from '../api'

const AGENTS = [
  { icon: '🎬', label: 'Frame Extractor',  sub: 'Sampling keyframes' },
  { icon: '👤', label: 'Face Detector',    sub: 'Isolating regions' },
  { icon: '🧠', label: 'ViT Ensemble',     sub: 'Neural inference' },
  { icon: '📊', label: 'Report Builder',   sub: 'Compiling results' },
]

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export default function UploadZone() {
  const { file, state, setFile, setState, setResult, setError, setAgentStep, reset } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const isLoading = state === 'loading'

  function applyFile(f: File) {
    if (f.type.startsWith('video/')) setFile(f)
    else setError('Please select a valid video file (MP4, AVI, MOV, MKV, WebM).')
  }

  async function handleAnalyze() {
    if (!file) return
    setState('loading')
    setAgentStep(0)

    // Simulate agent steps
    const delays = [0, 1800, 4200, 7500]
    delays.forEach((d, i) => setTimeout(() => setAgentStep(i), d))

    try {
      const result = await analyzeVideo(file)
      setResult(result)
    } catch (e: any) {
      setError(e.message || 'Analysis failed')
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-5">
      {/* Drop zone */}
      <motion.div
        className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 overflow-hidden
          ${dragging ? 'border-[#00ff88] bg-[#00ff8808] shadow-[0_0_40px_#00ff8820]' : 'border-[#00ff8830] hover:border-[#00ff8866] hover:bg-[#00ff8806]'}
          ${file ? 'py-6 px-8' : 'py-12 px-8'}`}
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) applyFile(f)
        }}
        whileHover={{ scale: file ? 1 : 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && applyFile(e.target.files[0])}
        />

        {!file ? (
          <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Orbit upload icon */}
            <div className="relative w-20 h-20 mx-auto mb-5">
              <motion.div
                className="absolute inset-0 rounded-full border border-dashed border-[#00ff8840]"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-3 rounded-full border border-[#00ff8820]"
                animate={{ rotate: -360 }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="28" height="28" fill="none" stroke="#00ff8899" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                </svg>
              </div>
            </div>
            <p className="text-white/80 font-semibold text-base mb-1">Drop video for forensic analysis</p>
            <p className="text-white/40 text-sm">Drag & drop or click to browse</p>
            <p className="text-white/20 text-xs mt-3 font-mono">MP4 · AVI · MOV · MKV · WebM — Max 100MB</p>
          </motion.div>
        ) : (
          <motion.div
            className="flex items-center gap-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-12 h-12 rounded-xl bg-[#00ff8812] border border-[#00ff8830] flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_#00ff8820]">
              <svg width="22" height="22" fill="none" stroke="#00ff88" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{file.name}</p>
              <p className="text-white/40 text-xs mt-0.5 font-mono">{fmtBytes(file.size)}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); reset() }}
              className="p-2 text-white/30 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Analyze button */}
      <motion.button
        disabled={!file || isLoading}
        onClick={handleAnalyze}
        className={`w-full py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-300 relative overflow-hidden
          ${file && !isLoading
            ? 'bg-gradient-to-r from-[#00ff88] to-[#00cc66] text-[#050508] shadow-[0_0_30px_#00ff8840] cursor-pointer'
            : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'}`}
        whileHover={file && !isLoading ? { scale: 1.02, boxShadow: '0 0 50px #00ff8860' } : {}}
        whileTap={file && !isLoading ? { scale: 0.98 } : {}}
      >
        {/* Shimmer */}
        {file && !isLoading && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <span className="relative z-10">
          {isLoading ? '⏳ Analyzing...' : '▶  Analyze Video'}
        </span>
      </motion.button>

      {/* Agent pipeline (loading state) */}
      {isLoading && <AgentPipeline />}
    </div>
  )
}

function AgentPipeline() {
  const agentStep = useStore((s) => s.agentStep)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 gap-3"
    >
      {AGENTS.map((agent, i) => {
        const active = i <= agentStep
        const current = i === agentStep
        return (
          <motion.div
            key={i}
            className={`rounded-xl p-3 border transition-all duration-500 flex items-center gap-3
              ${active
                ? 'border-[#00ff8844] bg-[#00ff8808] shadow-[0_0_15px_#00ff8815]'
                : 'border-white/5 bg-white/2'}`}
            animate={current ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 0.6, repeat: current ? Infinity : 0 }}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-500
              ${active ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]' : 'bg-white/15'}`} />
            <div>
              <p className="text-xs font-semibold text-white/80">{agent.label}</p>
              <p className={`text-[10px] font-mono transition-colors duration-300 ${active ? 'text-[#00ff88]' : 'text-white/30'}`}>
                {active ? (current ? agent.sub : 'Done ✓') : 'Waiting...'}
              </p>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
