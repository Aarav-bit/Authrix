import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploadInput from './FileUploadInput';
import InitiateButton from './InitiateButton';

interface UploadSectionProps {
  onAnalyze: (file: File) => void;
  onBack: () => void;
}

function fmtBytes(b: number) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

export default function UploadSection({ onAnalyze, onBack }: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [time, setTime] = useState('--:--:--');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const applyFile = useCallback((f: File) => {
    if (!f.type.startsWith('video/')) return;
    setFile(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) applyFile(f);
  }, [applyFile]);

  return (
    <section className="relative z-10 flex flex-col items-center justify-center pt-28 pb-24 px-6 min-h-screen">
      <div className="w-full max-w-3xl flex flex-col gap-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1
            className="text-3xl font-semibold"
            style={{
              background: 'linear-gradient(135deg, #c084fc, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.5))',
            }}
          >
            SECURE INGEST PORTAL
          </h1>
          <p className="text-sm font-medium tracking-wider text-purple-300/50">
            Awaiting encrypted payload via protocol AX-9.
          </p>
        </div>

        {/* Drop zone outer */}
        <div
          className="relative backdrop-blur-2xl rounded-xl overflow-hidden transition-colors duration-500"
          style={{
            background: 'rgba(30,15,50,0.4)',
            border: `1px solid ${dragging ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.15)'}`,
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04), 0 0 30px rgba(0,0,0,0.5)',
          }}
        >
          <div className="scan-line" style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(168,85,247,0.12) 50%, transparent 100%)' }} />

          {/* Drop zone inner */}
          <div
            onClick={() => {/* clicks handled by FileUploadInput */}}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="p-10 flex flex-col items-center justify-center border-2 border-dashed
              m-4 rounded-lg transition-all duration-300 cursor-pointer min-h-[300px]"
            style={{
              borderColor: dragging ? 'rgba(168,85,247,0.7)' : 'rgba(88,28,135,0.4)',
              background: dragging ? 'rgba(168,85,247,0.06)' : 'rgba(20,10,35,0.3)',
              boxShadow: dragging ? '0 0 40px rgba(168,85,247,0.12) inset' : 'none',
            }}
            onMouseEnter={e => {
              if (!dragging) {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(168,85,247,0.5)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(168,85,247,0.04)';
              }
            }}
            onMouseLeave={e => {
              if (!dragging) {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(88,28,135,0.4)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(20,10,35,0.3)';
              }
            }}
          >
            {!file ? (
              <div className="flex flex-col items-center gap-6">
                {/* Animated folder upload widget */}
                <FileUploadInput onFile={applyFile} />

                <h3 className="text-2xl font-semibold text-white text-center">
                  INITIALIZE UPLOAD
                </h3>
                <p className="text-base text-purple-300/50 text-center max-w-sm -mt-3">
                  Drag and drop your video file here, or use the button above.
                </p>
                <div className="flex items-center gap-2 font-bold text-[10px] text-purple-500/50 tracking-widest justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                  ACCEPTED: MP4 · AVI · MOV · MKV · WebM
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center gap-5">
                <div
                  className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(168,85,247,0.3)',
                    boxShadow: '0 0 20px rgba(124,58,237,0.15)',
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[28px]"
                    style={{ color: '#a855f7', fontVariationSettings: "'FILL' 1" }}
                  >
                    video_file
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium tracking-wider text-white overflow-hidden text-ellipsis whitespace-nowrap">
                    {file.name}
                  </p>
                  <p className="font-bold text-[10px] text-purple-300/50 mt-1">{fmtBytes(file.size)}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="p-2 rounded-sm transition-all text-purple-400/50 hover:text-red-400 hover:bg-red-400/10"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden input — used only by drag-and-drop path */}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && applyFile(e.target.files[0])}
        />

        {/* Initiate analysis button */}
        <InitiateButton onClick={() => file && onAnalyze(file)} disabled={!file} />

        {/* Active queue */}
        <div className="flex flex-col gap-4">
          <div
            className="flex items-center justify-between pb-2"
            style={{ borderBottom: '1px solid rgba(168,85,247,0.12)' }}
          >
            <h4 className="font-bold text-[10px] uppercase tracking-widest flex items-center gap-2"
              style={{ color: '#a855f7' }}>
              <span
                className="w-2 h-2"
                style={{ background: '#a855f7', boxShadow: '0 0 8px rgba(168,85,247,0.8)' }}
              />
              ACTIVE QUEUE
            </h4>
            <span className="font-mono text-[10px] text-purple-400/40">SYS_TIME: {time}</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {file ? (
              <div
                className="rounded p-4 flex items-center gap-3"
                style={{
                  background: 'rgba(20,10,35,0.6)',
                  border: '1px solid rgba(124,58,237,0.25)',
                }}
              >
                <span className="material-symbols-outlined text-[20px]" style={{ color: '#a855f7' }}>video_file</span>
                <span className="text-sm font-medium tracking-wider text-white truncate">{file.name}</span>
                <span
                  className="ml-auto font-bold text-[10px] uppercase tracking-widest"
                  style={{ color: '#a855f7' }}
                >
                  QUEUED
                </span>
              </div>
            ) : (
              <div
                className="rounded p-4 flex items-center gap-3 opacity-40"
                style={{
                  background: 'rgba(20,10,35,0.4)',
                  border: '1px solid rgba(88,28,135,0.2)',
                }}
              >
                <span className="material-symbols-outlined text-[20px] text-purple-500/50">inbox</span>
                <span className="text-sm font-medium tracking-wider text-purple-300/50">
                  No payload queued. Awaiting upload.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Back */}
        <div className="text-center">
          <button
            onClick={onBack}
            className="text-sm font-medium tracking-wider transition-colors flex items-center gap-2 mx-auto text-purple-400/40 hover:text-purple-300"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Command Center
          </button>
        </div>

      </div>
    </section>
  );
}
