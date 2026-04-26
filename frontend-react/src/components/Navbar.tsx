import { useEffect, useState } from 'react';

interface NavbarProps {
  onDashboard: () => void;
  onGetStarted: () => void;
  onOpenModal: (modal: string) => void;
}

export default function Navbar({ onDashboard, onGetStarted, onOpenModal }: NavbarProps) {
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    fetch('/health')
      .then(r => r.ok ? setHealth('online') : setHealth('offline'))
      .catch(() => setHealth('offline'));
  }, []);

  const dotColor = health === 'online' ? '#a855f7' : health === 'offline' ? '#f43f5e' : '#6b7280';
  const dotGlow  = health === 'online' ? '0 0 8px #a855f7' : health === 'offline' ? '0 0 8px #f43f5e' : 'none';

  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-16
        backdrop-blur-xl font-['Space_Grotesk'] tracking-wider uppercase text-xs"
      style={{
        background: 'rgba(8,4,18,0.7)',
        borderBottom: '1px solid rgba(168,85,247,0.15)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.6)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-8">
        <span
          onClick={onDashboard}
          className="text-2xl font-black tracking-tighter cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #c084fc, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.5))',
          }}
        >
          AUTHRIX AI
        </span>
        <div className="hidden md:flex items-center gap-1">
          {[
            { label: 'Dashboard', action: onDashboard },
            { label: 'Pricing',   action: () => window.open('/pricing', '_blank') },
            { label: 'Agents',    action: () => onOpenModal('agents') },
            { label: 'Logs',      action: () => onOpenModal('logs') },
            { label: 'Network',   action: () => onOpenModal('network') },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="py-1 px-3 rounded-sm transition-all duration-200 text-purple-400/50 hover:text-purple-300 hover:bg-purple-500/10"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Health badge */}
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-sm"
          style={{
            background: 'rgba(88,28,135,0.2)',
            border: '1px solid rgba(168,85,247,0.2)',
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: dotColor, boxShadow: dotGlow }} />
          <span className="font-bold text-[10px] text-purple-300/70 tracking-widest uppercase">
            {health === 'checking' ? 'CHECKING' : health === 'online' ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div
          className="hidden lg:flex items-center gap-1 pr-3 mr-1"
          style={{ borderRight: '1px solid rgba(168,85,247,0.15)' }}
        >
          {['sensors', 'memory', 'speed'].map(icon => (
            <button
              key={icon}
              className="p-1.5 rounded-sm transition-all text-purple-500/40 hover:text-purple-300 hover:bg-purple-500/10"
            >
              <span className="material-symbols-outlined text-lg">{icon}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onGetStarted}
          className="px-4 py-1.5 font-bold text-xs rounded-lg transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(168,85,247,0.8))',
            border: '1px solid rgba(168,85,247,0.5)',
            color: '#fff',
            boxShadow: '0 0 15px rgba(168,85,247,0.25)',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 25px rgba(168,85,247,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 15px rgba(168,85,247,0.25)')}
        >
          GET STARTED
        </button>
      </div>
    </nav>
  );
}
