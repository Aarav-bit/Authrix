export default function Background() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Subtle scan lines */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0) 50%,rgba(0,0,0,0.3) 50%)',
          backgroundSize: '100% 4px',
        }}
      />
      {/* Technical grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right,#6d28d9 1px,transparent 1px),linear-gradient(to bottom,#6d28d9 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Ambient purple glow — top right */}
      <div
        className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full blur-[140px]"
        style={{ background: 'rgba(124,58,237,0.07)' }}
      />
      {/* Ambient indigo glow — bottom left */}
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[120px]"
        style={{ background: 'rgba(79,46,220,0.06)' }}
      />
      {/* Noise */}
      <div className="absolute inset-0 noise-bg" />
    </div>
  );
}
