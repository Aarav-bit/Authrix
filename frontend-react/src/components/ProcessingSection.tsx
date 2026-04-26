import { useEffect, useState } from 'react';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'done';
  pct: number;
}

const PHASES = [
  { stepIdx: 0, pct: 20 },
  { stepIdx: 1, pct: 40 },
  { stepIdx: 2, pct: 65 },
  { stepIdx: 3, pct: 85 },
  { stepIdx: 4, pct: 98 },
];

const STEP_LABELS = [
  'Extracting frames...',
  'Detecting faces...',
  'Running ViT inference...',
  'Analyzing audio...',
  'Generating report...',
];

const P = 'rgba(168,85,247,';

export default function ProcessingSection() {
  const [steps, setSteps] = useState<Step[]>(
    STEP_LABELS.map(label => ({ label, status: 'pending', pct: 0 }))
  );
  const [overallPct, setOverallPct] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIdx(prev => {
        const next = prev + 1;
        if (next >= PHASES.length) { clearInterval(interval); return prev; }
        return next;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const phase = PHASES[phaseIdx];
    setOverallPct(phase.pct);
    setSteps(prev => prev.map((s, i) => {
      if (i < phase.stepIdx) return { ...s, status: 'done', pct: 100 };
      if (i === phase.stepIdx) return { ...s, status: 'active', pct: phase.pct };
      return { ...s, status: 'pending', pct: 0 };
    }));
  }, [phaseIdx]);

  const stepColor = (s: Step) =>
    s.status === 'active' ? '#c084fc' : s.status === 'done' ? '#a855f7' : 'rgba(168,85,247,0.25)';

  const stepIcon = (s: Step) =>
    s.status === 'active' ? 'sync' : s.status === 'done' ? 'check_circle' : 'hourglass_empty';

  return (
    <section className="relative z-10 flex flex-col items-center justify-center px-6 min-h-screen">
      <div className="absolute inset-0 noise-bg z-0" />

      {/* Purple scan line */}
      <div className="absolute left-0 w-full h-[2px] pointer-events-none opacity-50"
        style={{
          top: '30%',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(168,85,247,0.3) 50%, transparent 100%)',
          animation: 'scanMove 4s linear infinite',
        }}
      />

      <div className="relative z-10 w-full max-w-4xl pt-24 pb-16 flex flex-col items-center">

        {/* Header */}
        <div className="w-full mb-12 text-center">
          <h1
            className="text-5xl font-black mb-2"
            style={{
              background: 'linear-gradient(135deg, #c084fc, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.4))',
            }}
          >
            SYSTEM_STATE: ANALYSIS
          </h1>
          <p className="text-sm tracking-[0.2em] uppercase" style={{ color: 'rgba(192,132,252,0.5)' }}>
            Initiating Deep Inspection Protocol
          </p>
        </div>

        {/* Bento grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* Left: Orb */}
          <div
            className="md:col-span-5 rounded-xl p-6 flex flex-col items-center justify-center relative min-h-[300px]"
            style={{
              background: 'rgba(20,10,40,0.5)',
              border: '1px solid rgba(168,85,247,0.15)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div className="absolute top-3 left-4 font-bold text-[10px] tracking-widest uppercase"
              style={{ color: 'rgba(168,85,247,0.4)' }}>
              Target Vector
            </div>

            <div
              className="relative w-48 h-48 rounded-full flex items-center justify-center"
              style={{
                border: '1px solid rgba(168,85,247,0.25)',
                boxShadow: '0 0 30px rgba(124,58,237,0.12)',
              }}
            >
              <div
                className="absolute inset-2 rounded-full border-dashed animate-spin-medium"
                style={{ border: '1px dashed rgba(168,85,247,0.3)' }}
              />
              <div
                className="absolute inset-6 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: 'radial-gradient(circle, rgba(88,28,135,0.3) 0%, rgba(13,7,32,0.8) 100%)',
                }}
              >
                <span
                  className="material-symbols-outlined text-[48px] opacity-40"
                  style={{ color: '#a855f7', fontVariationSettings: "'FILL' 1" }}
                >
                  analytics
                </span>
              </div>
              <div
                className="absolute inset-0 rounded-full border-t-2 blur-[2px] animate-spin-fast"
                style={{ borderColor: 'rgba(168,85,247,0.7)' }}
              />
              <span
                className="material-symbols-outlined absolute text-4xl"
                style={{ color: '#c084fc', filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.8))' }}
              >
                troubleshoot
              </span>
            </div>

            <div className="mt-6 w-full">
              {[
                { label: 'DATA_STREAM', value: 'ACTIVE',   valueColor: '#a855f7' },
                { label: 'THROUGHPUT',  value: '2.4 TB/s', valueColor: '#818cf8' },
              ].map(({ label, value, valueColor }) => (
                <div
                  key={label}
                  className="flex items-center justify-between text-sm font-medium tracking-wider pb-1 mb-1"
                  style={{ borderBottom: '1px solid rgba(168,85,247,0.08)', color: 'rgba(192,132,252,0.5)' }}
                >
                  <span>{label}</span>
                  <span style={{ color: valueColor, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Pipeline */}
          <div
            className="md:col-span-7 rounded-xl p-6 flex flex-col justify-center gap-4"
            style={{
              background: 'rgba(20,10,40,0.5)',
              border: '1px solid rgba(168,85,247,0.15)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-[10px] tracking-widest uppercase"
                style={{ color: 'rgba(168,85,247,0.4)' }}>
                Processing Pipeline
              </span>
              <span
                className="text-sm font-bold px-3 py-1 rounded"
                style={{
                  color: '#c084fc',
                  background: 'rgba(124,58,237,0.2)',
                  border: '1px solid rgba(168,85,247,0.3)',
                }}
              >
                {overallPct}% COMPLETE
              </span>
            </div>

            {steps.map((step, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 transition-opacity duration-400"
                style={{ opacity: step.status === 'pending' ? 0.3 : 1 }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ color: stepColor(step) }}
                    >
                      {stepIcon(step)}
                    </span>
                    <span className="text-sm font-medium tracking-wider text-white/80">
                      {step.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: stepColor(step) }}>
                    {step.status === 'done' ? '100%' : step.status === 'active' ? `${step.pct}%` : '0%'}
                  </span>
                </div>
                <div className="w-full h-2 flex gap-[2px] rounded overflow-hidden"
                  style={{ background: 'rgba(88,28,135,0.2)' }}>
                  {Array.from({ length: 10 }).map((_, j) => {
                    const filled = step.status === 'done' || (step.status === 'active' && j < Math.round(step.pct / 10));
                    return (
                      <div key={j} className="h-full flex-1 transition-all duration-500"
                        style={{
                          background: filled
                            ? step.status === 'done'
                              ? `${P}0.55)`
                              : `${P}0.85)`
                            : `${P}0.08)`,
                          boxShadow: filled && step.status === 'active' ? `0 0 6px ${P}0.5)` : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overall progress */}
        <div
          className="w-full mt-6 rounded-xl p-4"
          style={{
            background: 'rgba(20,10,40,0.5)',
            border: '1px solid rgba(168,85,247,0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-[10px] tracking-widest uppercase"
              style={{ color: 'rgba(168,85,247,0.4)' }}>
              Overall Progress
            </span>
            <span className="text-sm font-bold" style={{ color: '#c084fc' }}>{overallPct}%</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden"
            style={{ background: 'rgba(88,28,135,0.2)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${overallPct}%`,
                background: 'linear-gradient(to right, #7c3aed, #a855f7, #c084fc)',
                boxShadow: '0 0 12px rgba(168,85,247,0.5)',
              }}
            />
          </div>
        </div>

      </div>
    </section>
  );
}
