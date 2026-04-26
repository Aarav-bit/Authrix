import GridScan from './GridScan';
import AnalyzeButton from './AnalyzeButton';

interface HeroSectionProps {
  onAnalyze: () => void;
}

export default function HeroSection({ onAnalyze }: HeroSectionProps) {
  return (
    <section className="relative w-full min-h-screen overflow-hidden">

      {/* GridScan — true full-viewport background */}
      <div className="absolute inset-0 z-0">
        <GridScan
          sensitivity={0.5}
          lineThickness={1}
          linesColor="#2a1a3e"
          gridScale={0.1}
          scanColor="#a855f7"
          scanOpacity={0.45}
          enablePost={true}
          bloomIntensity={0.7}
          bloomThreshold={0.1}
          bloomSmoothing={0.2}
          chromaticAberration={0.003}
          noiseIntensity={0.012}
          scanDirection="pingpong"
          scanDuration={2.5}
          scanDelay={1.2}
          scanGlow={0.7}
          scanSoftness={2.5}
          scanPhaseTaper={0.85}
        />
      </div>

      {/* Dark purple gradient overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(88,28,135,0.18) 0%, rgba(10,5,20,0.55) 70%, rgba(5,2,12,0.85) 100%)',
        }}
      />

      {/* ── Two-column layout: left content / right orb ── */}
      <div className="relative z-10 flex items-center min-h-screen pt-16 px-4 md:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full min-h-[calc(100vh-4rem)]">

          {/* ── LEFT: text + buttons + stats ── */}
          <div className="flex flex-col items-start space-y-6 -ml-2 md:-ml-6 lg:-ml-10">

            {/* Status badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md"
              style={{
                background: 'rgba(88,28,135,0.3)',
                border: '1px solid rgba(168,85,247,0.25)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: '#a855f7', boxShadow: '0 0 8px #a855f7' }}
              />
              <span className="font-bold text-[10px] text-purple-300/80 uppercase tracking-[0.18em]">
                AI-Powered Authenticity Engine
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight"
              style={{ textShadow: '0 0 60px rgba(168,85,247,0.2)' }}
            >
              <span className="text-white">Verify Reality</span>
              <br />
              <span className="text-white">in </span>
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #c084fc 0%, #a855f7 40%, #7c3aed 70%, #4f46e5 100%)',
                }}
              >
                Real-Time
              </span>
            </h1>

            {/* Subtext */}
            <p className="text-base text-purple-200/55 max-w-lg leading-relaxed">
              Deploy advanced neural networks to detect deepfakes, synthetic media, and manipulated
              data streams with military-grade precision. Establish an unbreakable perimeter of truth.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <AnalyzeButton onClick={onAnalyze} />


            </div>

            {/* Stats */}
            <div
              className="flex items-center gap-8 pt-6 mt-4 border-t w-full max-w-sm"
              style={{ borderColor: 'rgba(168,85,247,0.15)' }}
            >
              <div>
                <div
                  className="text-xl font-black tracking-tight"
                  style={{ color: '#c084fc', textShadow: '0 0 16px rgba(168,85,247,0.5)' }}
                >
                  99.9%
                </div>
                <div className="font-bold text-[10px] text-purple-400/50 mt-1 uppercase tracking-widest">
                  Accuracy Rate
                </div>
              </div>
              <div className="w-px h-8" style={{ background: 'rgba(168,85,247,0.2)' }} />
              <div>
                <div
                  className="text-xl font-black tracking-tight"
                  style={{ color: '#a78bfa', textShadow: '0 0 16px rgba(139,92,246,0.5)' }}
                >
                  &lt;15ms
                </div>
                <div className="font-bold text-[10px] text-purple-400/50 mt-1 uppercase tracking-widest">
                  Latency Ping
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Orb visualizer ── */}
          <div className="relative w-full aspect-square max-w-lg mx-auto flex items-center justify-center lg:justify-end">

            {/* Outer ambient glow */}
            <div
              className="absolute inset-0 rounded-full blur-[60px]"
              style={{ background: 'rgba(124,58,237,0.12)' }}
            />

            {/* Orb shell */}
            <div
              className="relative w-4/5 h-4/5 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 40% 35%, rgba(124,58,237,0.15) 0%, rgba(8,4,18,0.7) 100%)',
                border: '1px solid rgba(168,85,247,0.15)',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.7), 0 0 60px rgba(124,58,237,0.15)',
              }}
            >
              {/* Spinning rings */}
              <div
                className="absolute w-[115%] h-[115%] rounded-full animate-spin-slow"
                style={{ border: '1px solid rgba(168,85,247,0.1)' }}
              />
              <div
                className="absolute w-full h-full rounded-full animate-spin-slow-reverse"
                style={{ border: '1px dashed rgba(139,92,246,0.15)' }}
              />
              <div
                className="absolute w-4/5 h-4/5 rounded-full"
                style={{ border: '1px solid rgba(168,85,247,0.06)' }}
              />

              {/* Core */}
              <div
                className="relative w-3/5 h-3/5 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, rgba(8,4,18,0.9) 100%)',
                  border: '1px solid rgba(168,85,247,0.25)',
                  boxShadow: '0 0 40px rgba(124,58,237,0.2)',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 100,
                    color: '#c084fc',
                    opacity: 0.45,
                    fontVariationSettings: "'FILL' 1",
                    filter: 'drop-shadow(0 0 20px rgba(168,85,247,0.9))',
                  }}
                >
                  radar
                </span>
                {/* Spinning accent border */}
                <div
                  className="absolute inset-0 rounded-full border-t-2 blur-[2px] animate-spin-fast"
                  style={{ borderColor: 'rgba(168,85,247,0.6)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050210]/60 via-transparent to-transparent" />
              </div>
            </div>

            {/* Floating HUD chips */}
            <div
              className="absolute top-8 -left-2 px-3 py-1 font-mono text-[10px] backdrop-blur-md rounded-sm"
              style={{
                background: 'rgba(8,4,18,0.75)',
                border: '1px solid rgba(168,85,247,0.3)',
                color: '#c084fc',
              }}
            >
              SYS.OPT.OK
            </div>
            <div
              className="absolute bottom-16 -right-2 px-3 py-1 font-mono text-[10px] backdrop-blur-md rounded-sm flex items-center gap-1"
              style={{
                background: 'rgba(8,4,18,0.75)',
                border: '1px solid rgba(139,92,246,0.3)',
                color: '#a78bfa',
              }}
            >
              <span className="material-symbols-outlined text-[11px]">sync</span> LIVE
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
