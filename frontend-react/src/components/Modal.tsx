interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-xl p-8"
        style={{
          background: 'rgba(13,7,32,0.95)',
          border: '1px solid rgba(168,85,247,0.25)',
          boxShadow: '0 0 60px rgba(88,28,135,0.3)',
          backdropFilter: 'blur(20px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold uppercase tracking-widest" style={{ color: '#c084fc' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-all text-purple-400/40 hover:text-purple-300 hover:bg-purple-500/10"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
