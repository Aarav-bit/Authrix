import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import RadioNav from '../components/RadioNav';
import Modal from '../components/Modal';

const plans = [
  {
    name: 'Free', price: '$0', interval: '/mo', desc: 'Perfect for trying out',
    features: ['10 video analyses/month', 'Browser extension', 'Max 2-minute videos', 'Community support'],
    cta: 'Get Started Free', popular: false,
  },
  {
    name: 'Pro', price: '$9.99', interval: '/mo', desc: 'For individuals & creators',
    features: ['100 analyses/month', 'Up to 10-minute videos', 'API access (100 calls/mo)', 'Priority processing', 'Email support', 'Batch upload'],
    cta: 'Subscribe to Pro', popular: true,
  },
  {
    name: 'Business', price: '$49', interval: '/mo', desc: 'For teams & organizations',
    features: ['1,000 analyses/month', 'Unlimited video length', 'API access (5K calls/mo)', 'White-label reports', 'Slack/Teams integration', 'Priority support', 'Custom branding'],
    cta: 'Subscribe to Business', popular: false,
  },
];

const faqs = [
  { q: 'How accurate is Authrix?', a: 'Authrix uses an ensemble of state-of-the-art ViT models achieving 99%+ accuracy on benchmark datasets. We combine visual analysis with audio detection for comprehensive deepfake identification.' },
  { q: 'Can I cancel anytime?', a: 'Yes! All subscriptions are month-to-month with no long-term commitment. Cancel anytime from your account dashboard.' },
  { q: 'What video formats are supported?', a: 'We support MP4, AVI, MOV, MKV, WebM, and WMV formats. Maximum file size is 100MB for Pro tier, unlimited for Business and Enterprise.' },
  { q: 'Is my data secure?', a: 'Absolutely. All videos are analyzed locally and deleted immediately after processing. We never store your content or share it with third parties.' },
  { q: 'Do you offer refunds?', a: "Yes, we offer a 30-day money-back guarantee. If you're not satisfied, contact support for a full refund." },
];

const AGENTS = [
  { name: 'MetadataAgent',        desc: 'Scans C2PA signatures and AI tool metadata in the first 512KB.' },
  { name: 'FrameAnalyzerAgent',   desc: 'Extracts up to 40 frames uniformly across the video duration.' },
  { name: 'FaceDetectorAgent',    desc: 'Uses MediaPipe to detect and crop facial regions with 20% padding.' },
  { name: 'DecisionAgent (ViT)',  desc: 'Ensemble of two ViT models (99.3% + 92.1% accuracy) with early exit.' },
  { name: 'AudioAuthenticator',   desc: 'Wav2Vec2-based audio analysis with librosa heuristics for AV mismatch.' },
  { name: 'ReportGeneratorAgent', desc: 'Adaptive threshold + confidence calibration to produce the final verdict.' },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<string | null>(null);

  const handleNav = (id: string) => {
    if (id === 'dashboard' || id === 'analyze') navigate('/');
    else if (id === 'agents') setModal('agents');
    else if (id === 'settings') setModal('settings');
    // 'pricing' — already here, do nothing
  };

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at 30% 20%, #1a0a2e 0%, #0a0414 40%, #050210 100%)', color: '#e2d9f3', fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(to right,#6d28d9 1px,transparent 1px),linear-gradient(to bottom,#6d28d9 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

      <RadioNav active="pricing" onNavigate={handleNav} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-20">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(88,28,135,0.3)', border: '1px solid rgba(168,85,247,0.25)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#a855f7', boxShadow: '0 0 8px #a855f7' }} />
            <span className="font-bold text-[10px] text-purple-300/80 uppercase tracking-[0.18em]">Transparent Pricing</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-4"
            style={{ background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Choose Your Plan
          </h1>
          <p className="text-lg text-purple-200/50 max-w-xl mx-auto">
            Protect yourself from deepfakes with AI-powered detection. Start free, upgrade anytime.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map(plan => (
            <div key={plan.name} className="relative rounded-2xl p-8 flex flex-col transition-all duration-300 hover:-translate-y-2"
              style={{
                background: plan.popular ? 'rgba(88,28,135,0.25)' : 'rgba(20,10,40,0.5)',
                border: plan.popular ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(168,85,247,0.12)',
                boxShadow: plan.popular ? '0 0 40px rgba(124,58,237,0.2)' : 'none',
                backdropFilter: 'blur(20px)',
              }}>
              {plan.popular && (
                <div className="absolute -top-3 right-6 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}>
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <div className="text-xl font-bold mb-1" style={{ color: '#c084fc' }}>{plan.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-black text-white">{plan.price}</span>
                  <span className="text-lg text-purple-300/40 mb-1">{plan.interval}</span>
                </div>
                <div className="text-sm text-purple-300/40">{plan.desc}</div>
              </div>
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-purple-200/70">
                    <span style={{ color: '#a855f7', fontSize: 18 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => alert(`${plan.name} plan selected. Payment integration coming soon.`)}
                className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 active:scale-95"
                style={plan.popular
                  ? { background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }
                  : { background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl p-12 text-center mb-16"
          style={{ background: 'rgba(88,28,135,0.1)', border: '1px solid rgba(168,85,247,0.2)', backdropFilter: 'blur(20px)' }}>
          <h2 className="text-4xl font-black mb-3" style={{ color: '#c084fc' }}>Enterprise Solutions</h2>
          <p className="text-lg text-purple-200/50 max-w-2xl mx-auto mb-8">
            Custom solutions for large organizations, social media platforms, and government agencies.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { icon: '🏢', title: 'On-Premise Deployment', desc: 'Deploy on your own infrastructure' },
              { icon: '🎯', title: 'Custom Model Training',  desc: 'Train on your specific content' },
              { icon: '⚡', title: 'Unlimited Analyses',     desc: 'No limits on API calls' },
              { icon: '🛡️', title: 'SLA Guarantees',         desc: '99.9% uptime, dedicated support' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-xl p-5"
                style={{ background: 'rgba(20,10,40,0.5)', border: '1px solid rgba(168,85,247,0.1)' }}>
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-sm font-bold mb-1" style={{ color: '#c084fc' }}>{title}</div>
                <div className="text-xs text-purple-300/40">{desc}</div>
              </div>
            ))}
          </div>
          <button onClick={() => alert('Enterprise inquiry! Contact us at support@authrix.ai')}
            className="px-10 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}>
            Contact Sales
          </button>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-8" style={{ color: '#c084fc' }}>Frequently Asked Questions</h2>
          <div className="flex flex-col gap-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="rounded-xl p-6"
                style={{ background: 'rgba(20,10,40,0.5)', border: '1px solid rgba(168,85,247,0.1)', backdropFilter: 'blur(20px)' }}>
                <div className="text-base font-bold mb-2" style={{ color: '#c084fc' }}>{q}</div>
                <div className="text-sm leading-relaxed text-purple-200/50">{a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pt-8" style={{ borderTop: '1px solid rgba(168,85,247,0.1)' }}>
          <div className="flex justify-center gap-8 mb-4 flex-wrap">
            {[{ label: 'Home', href: '/' }, { label: 'API Docs', href: 'https://docs.authrix.ai' }, { label: 'Support', href: 'mailto:support@authrix.ai' }]
              .map(({ label, href }) => (
                <a key={label} href={href} className="text-sm transition-colors text-purple-400/40 hover:text-purple-300">{label}</a>
              ))}
          </div>
          <p className="text-sm text-purple-400/25">© 2026 Authrix AI. All rights reserved.</p>
        </div>

      </div>

      {/* Agents modal */}
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

      {/* Settings modal */}
      {modal === 'settings' && (
        <Modal title="Network Status" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'API Endpoint',     value: 'https://aarav13-authrix.hf.space' },
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
