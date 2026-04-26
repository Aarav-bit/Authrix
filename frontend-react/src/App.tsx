import { useState } from 'react';
import type { AnalysisResult, AppState } from './types';
import { API_BASE } from './api';
import Background from './components/Background';
import RadioNav from './components/RadioNav';
import HeroSection from './components/HeroSection';
import UploadSection from './components/UploadSection';
import ProcessingSection from './components/ProcessingSection';
import ResultSection from './components/ResultSection';
import ErrorSection from './components/ErrorSection';
import Modal from './components/Modal';

const AGENTS = [
  { name: 'MetadataAgent',       desc: 'Scans C2PA signatures and AI tool metadata in the first 512KB of the file.' },
  { name: 'FrameAnalyzerAgent',  desc: 'Extracts up to 40 frames uniformly across the video duration.' },
  { name: 'FaceDetectorAgent',   desc: 'Uses MediaPipe to detect and crop facial regions with 20% padding.' },
  { name: 'DecisionAgent (ViT)', desc: 'Ensemble of two ViT models (99.3% + 92.1% accuracy) with early exit.' },
  { name: 'AudioAuthenticator',  desc: 'Wav2Vec2-based audio analysis with librosa heuristics for AV mismatch.' },
  { name: 'ReportGeneratorAgent',desc: 'Adaptive threshold + confidence calibration to produce the final verdict.' },
];

export default function App() {
  const [state, setState] = useState<AppState>('hero');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError]   = useState('');
  const [modal, setModal]   = useState<string | null>(null);

  async function handleAnalyze(file: File) {
    setState('processing');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error((e as { detail?: string }).detail || `Server error ${res.status}`);
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
      setState('result');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection to analysis engine failed.');
      setState('error');
    }
  }

  const activeNav =
    state === 'hero'       ? 'dashboard' :
    state === 'upload'     ? 'analyze'   :
    state === 'processing' ? 'analyze'   :
    state === 'result'     ? 'analyze'   : 'dashboard';

  const handleNav = (id: string) => {
    if (id === 'dashboard') setState('hero');
    else if (id === 'analyze') setState('upload');
    else if (id === 'pricing') window.location.href = '/pricing';
    else if (id === 'agents') setModal('agents');
    else if (id === 'settings') setModal('network');
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      <Background />

      <RadioNav active={activeNav} onNavigate={handleNav} />

      {state === 'hero'       && <HeroSection onAnalyze={() => setState('upload')} />}
      {state === 'upload'     && <UploadSection onAnalyze={handleAnalyze} onBack={() => setState('hero')} />}
      {state === 'processing' && <ProcessingSection />}
      {state === 'result'     && result && <ResultSection result={result} onReset={() => setState('upload')} />}
      {state === 'error'      && <ErrorSection message={error} onRetry={() => setState('upload')} />}

      {/* Agents Modal */}
      {modal === 'agents' && (
        <Modal title="Detection Agents" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4">
            {AGENTS.map((ag, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg"
                style={{ background: 'rgba(30,15,50,0.6)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
                  {i}
                </div>
                <div>
                  <div className="text-sm font-semibold mb-1" style={{ color: '#c084fc' }}>{ag.name}</div>
                  <div className="text-xs text-purple-300/50">{ag.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Logs Modal */}
      {modal === 'logs' && (
        <Modal title="System Logs" onClose={() => setModal(null)}>
          <div className="rounded-lg p-4 font-mono text-xs space-y-1 max-h-80 overflow-y-auto"
            style={{ background: 'rgba(8,4,18,0.9)', color: '#a855f7' }}>
            {[
              '[BOOT] Authrix AI v2.2.0 initialized',
              '[SYS] ViT ensemble models loaded',
              '[SYS] MediaPipe face detector ready',
              '[SYS] Wav2Vec2 audio model ready',
              '[SYS] C2PA metadata scanner active',
              '[NET] FastAPI server listening on :8000',
              '[AUTH] API key validation enabled',
              '[CACHE] SHA256 result cache initialized',
            ].map((line, i) => (
              <div key={i} className="opacity-70">{line}</div>
            ))}
          </div>
        </Modal>
      )}

      {/* Network Modal */}
      {modal === 'network' && (
        <Modal title="Network Status" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'API Endpoint',     value: window.location.origin },
              { label: 'HF Space',         value: 'aarav13-authrix.hf.space' },
              { label: 'Max File Size',    value: '100 MB' },
              { label: 'Request Timeout',  value: '120s' },
              { label: 'Capture Duration', value: '8s' },
              { label: 'Cache',            value: 'SHA256 (1MB)' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg p-4"
                style={{ background: 'rgba(20,10,35,0.6)', border: '1px solid rgba(88,28,135,0.25)' }}>
                <div className="text-[10px] uppercase tracking-widest mb-1 text-purple-500/50">{label}</div>
                <div className="text-sm font-bold font-mono" style={{ color: '#c084fc' }}>{value}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
