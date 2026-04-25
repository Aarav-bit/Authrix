import React, { useState, useRef } from 'react';
import Loader from './components/Loader';
const API_BASE = 'http://localhost:8000';

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle', 'analyzing', 'result', 'error'
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile);
    } else {
      setErrorMsg('Please drop a valid video file (MP4, AVI, MOV, MKV, WebM).');
      setStatus('error');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStatus('analyzing');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: formData });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setResultData(data);
      setStatus('result');
    } catch (err) {
      setErrorMsg(err.message || 'Connection to analysis engine failed.');
      setStatus('error');
    }
  };

  const resetAll = () => {
    setFile(null);
    setResultData(null);
    setErrorMsg('');
    setStatus('idle');
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <>
      <div className="scanner"></div>

      <div className="max-w-5xl mx-auto px-6 py-12 min-h-screen flex flex-col relative z-10">
        
        {/* Header */}
        <header className="text-center mb-12 fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(0,255,156,0.3)] bg-[rgba(0,255,156,0.05)] mb-6 shadow-[0_0_15px_rgba(0,255,156,0.1)]">
            <div className="w-2 h-2 rounded-full bg-[#00ff9c] shadow-[0_0_8px_#00ff9c] animate-pulse"></div>
            <span className="text-[10px] font-semibold tracking-[0.2em] text-[#00ff9c] uppercase">AI & Machine Learning</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">Deepfake <span className="text-glow">Authenticator</span></h1>
          <p className="text-[#849ca3] text-sm md:text-base font-light tracking-wide">Advanced video forensics and digital truth verification.</p>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center gap-8 w-full">
          
          {status === 'idle' && (
            <section className="w-full max-w-3xl glass p-8 fade-up" style={{ animationDelay: '0.2s' }}>
              <div 
                className="glass-inner rounded-xl border-2 border-dashed border-[rgba(0,255,156,0.15)] hover:border-[#00ff9c] transition-all cursor-pointer min-h-[200px] flex items-center justify-center relative overflow-hidden"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {!file ? (
                  <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-[rgba(0,255,156,0.2)] flex items-center justify-center bg-[rgba(0,255,156,0.02)] shadow-[0_0_20px_rgba(0,255,156,0.05)]">
                      <svg className="w-8 h-8 text-[#00ff9c] opacity-70" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Upload Video for Analysis</h3>
                    <p className="text-sm text-[#849ca3]">Drag & drop or click to browse</p>
                    <p className="text-[11px] text-[#849ca3] mt-4 opacity-60">MP4, AVI, MOV, MKV, WebM — Max 100MB</p>
                  </div>
                ) : (
                  <div className="w-full p-8 flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                    <div className="w-14 h-14 rounded-lg bg-[rgba(0,255,156,0.1)] border border-[rgba(0,255,156,0.3)] flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(0,255,156,0.15)]">
                      <svg className="w-7 h-7 text-[#00ff9c]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                      <p className="text-xs text-[#849ca3] mt-1">{formatBytes(file.size)}</p>
                    </div>
                    <button onClick={() => setFile(null)} className="p-2 text-[#849ca3] hover:text-[#ff4444] transition-colors rounded-lg hover:bg-[rgba(255,68,68,0.1)]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />

              <div className="mt-8 text-center">
                <button 
                  onClick={handleAnalyze} 
                  disabled={!file}
                  className={`border border-[rgba(0,255,156,0.15)] rounded-lg px-10 py-3 font-semibold text-sm tracking-widest uppercase transition-all ${
                    file 
                      ? 'bg-[#00ff9c] text-[#040906] shadow-[0_0_20px_rgba(0,255,156,0.4)] hover:bg-[#00cc7d] hover:-translate-y-1' 
                      : 'text-[#849ca3] opacity-50 cursor-not-allowed'
                  }`}
                >
                  Analyze Video
                </button>
              </div>
            </section>
          )}

          {status === 'analyzing' && (
            <section className="fade-up w-full flex justify-center py-20">
              <Loader />
            </section>
          )}

          {status === 'result' && resultData && (
            <section className="w-full flex flex-col gap-10 fade-up">
              
              <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 w-full max-w-3xl mx-auto">
                <div className={`flex-1 glass p-8 text-center border-t-4 flex flex-col justify-center ${resultData.result === 'FAKE' ? 'border-t-[#ff4444] shadow-[0_-5px_20px_rgba(255,68,68,0.15)]' : 'border-t-[#00ff9c] shadow-[0_-5px_20px_rgba(0,255,156,0.15)]'}`}>
                  <p className="text-[#849ca3] text-xs font-semibold tracking-[0.2em] uppercase mb-2">Verdict</p>
                  <h2 className={`text-4xl font-bold tracking-widest ${resultData.result === 'FAKE' ? 'text-[#ff4444] drop-shadow-[0_0_10px_rgba(255,68,68,0.5)]' : 'text-[#00ff9c] drop-shadow-[0_0_10px_rgba(0,255,156,0.5)]'}`}>
                    {resultData.result}
                  </h2>
                  <div className="mt-4 inline-block bg-[rgba(255,255,255,0.05)] px-4 py-1.5 rounded-full border border-[rgba(255,255,255,0.1)]">
                    <span className="text-[#849ca3] text-xs uppercase tracking-wider mr-2">Confidence:</span>
                    <span className="text-white font-bold">{resultData.confidence}%</span>
                  </div>
                </div>

                <div className="flex-1 glass p-8 text-center border-t-4 border-t-[#00e5ff] shadow-[0_-5px_20px_rgba(0,229,255,0.15)] flex flex-col justify-center">
                  <p className="text-[#849ca3] text-xs font-semibold tracking-[0.2em] uppercase mb-2">Metrics</p>
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex justify-between items-center bg-[rgba(255,255,255,0.03)] p-3 rounded border border-[rgba(255,255,255,0.05)]">
                      <span className="text-xs text-[#849ca3] uppercase tracking-wider">Frames</span>
                      <span className="text-white font-mono font-medium">{resultData.metadata?.frames_analyzed || 0}</span>
                    </div>
                    <div className="flex justify-between items-center bg-[rgba(255,255,255,0.03)] p-3 rounded border border-[rgba(255,255,255,0.05)]">
                      <span className="text-xs text-[#849ca3] uppercase tracking-wider">Time</span>
                      <span className="text-[#00e5ff] font-mono font-medium">{resultData.processing_time_sec || 0}s</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-3xl mx-auto glass p-8 mt-4">
                <h3 className="text-xs font-semibold tracking-[0.15em] text-[#00e5ff] uppercase flex items-center gap-2 mb-4">
                  <div className="w-1 h-3 rounded-sm bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></div>
                  Analysis Insights
                </h3>
                <div className="flex flex-col gap-3">
                  {(resultData.details || ['Analysis completed successfully.']).map((txt, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                      <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${resultData.result === 'FAKE' ? 'bg-[#ff4444] shadow-[0_0_8px_rgba(255,68,68,0.6)]' : 'bg-[#00ff9c] shadow-[0_0_8px_rgba(0,255,156,0.6)]'}`}></span>
                      <span className="text-sm text-[#a0aec0]">{txt}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center mt-4">
                <button onClick={resetAll} className="px-6 py-3 text-xs font-semibold tracking-widest uppercase text-[#849ca3] border border-[#849ca3]/30 rounded-lg hover:text-[#00ff9c] hover:border-[#00ff9c]/50 hover:bg-[#00ff9c]/5 transition-all">
                  <span className="mr-2">↻</span> Analyze Another Video
                </button>
              </div>
            </section>
          )}

          {status === 'error' && (
            <section className="glass p-6 border-[#ff4444]/30 bg-[#ff4444]/5 fade-up w-full max-w-3xl">
              <div className="flex items-center gap-3 mb-2">
                <svg className="w-6 h-6 text-[#ff4444]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-sm font-bold tracking-widest text-[#ff4444] uppercase">Analysis Failed</span>
              </div>
              <p className="text-sm text-[#849ca3] ml-9">{errorMsg}</p>
              <div className="ml-9 mt-4">
                <button onClick={resetAll} className="text-xs text-white/50 hover:text-white uppercase tracking-wider transition-colors">
                  ↻ Try Again
                </button>
              </div>
            </section>
          )}

        </main>
        
        <footer className="mt-16 text-center text-[10px] text-[#849ca3]/50 tracking-[0.2em] uppercase">
          Deepfake Authenticator • Secure Cybernetic Analysis • Local Inference
        </footer>

      </div>
    </>
  );
}

export default App;
