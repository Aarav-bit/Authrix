interface ErrorSectionProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorSection({ message, onRetry }: ErrorSectionProps) {
  return (
    <section className="relative z-10 flex flex-col items-center justify-center px-6 min-h-screen">
      <div className="w-full max-w-lg glass-panel rounded-xl p-10 flex flex-col items-center gap-6 text-center glow-border-error">
        <div className="w-20 h-20 rounded-full bg-[#ffb4ab]/10 border border-[#ffb4ab]/30
          flex items-center justify-center shadow-[0_0_30px_rgba(255,180,171,0.2)]">
          <span className="material-symbols-outlined text-[#ffb4ab] text-[40px]">error</span>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[#ffb4ab] mb-2">ANALYSIS FAILED</h2>
          <p className="text-sm text-[#b9cbbc]">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="px-8 py-3 bg-[#ffb4ab]/10 border border-[#ffb4ab]/50 text-[#ffb4ab]
            font-bold text-xs uppercase tracking-wider rounded hover:bg-[#ffb4ab]/20
            transition-all active:scale-95"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Try Again
          </span>
        </button>
      </div>
    </section>
  );
}
