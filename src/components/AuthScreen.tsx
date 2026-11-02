import { useState } from 'react';
import { useStore } from '../lib/store';
import { MAIN_SUBJECTS, EXPLORING } from '../lib/moderation';

const inputCls =
  'w-full text-sm text-[#262626] placeholder:text-[#8e8e8e] bg-[#fafafa] border border-[#dbdbdb] rounded-lg px-3 py-2.5 outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20 transition';

export default function AuthScreen() {
  const { signUp, logIn } = useStore();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ identifier: '', username: '', displayName: '', email: '', password: '', subject: EXPLORING });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === 'login' ? await logIn(f.identifier, f.password) : await signUp(f);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-[#fafafa]">
      <aside className="hidden lg:flex ai-badge-bg text-white flex-col justify-between p-14">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          </div>
          <span className="text-lg font-bold tracking-tight">ReLearn</span>
        </div>
        <div>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight max-w-md">Share what you learn. Learn from who you follow.</h1>
          <ul className="mt-8 space-y-3 text-white/85 text-[15px]">
            <li>Post notes, diagrams and short study videos</li>
            <li>Every post is checked by our AI for academic relevance</li>
            <li>Follow classmates and message study partners</li>
          </ul>
        </div>
        <p className="text-xs text-white/60">Only real people, only study content.</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg ai-badge-bg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            </div>
            <span className="text-lg font-bold text-[#262626]">ReLearn</span>
          </div>

          <div className="bg-white border border-[#dbdbdb] rounded-2xl p-7">
            <h2 className="text-xl font-bold text-[#262626]">{mode === 'signup' ? 'Create your profile' : 'Welcome back'}</h2>
            <p className="text-sm text-[#8e8e8e] mt-1 mb-5">
              {mode === 'signup' ? 'Join ReLearn with your own account.' : 'Log in to keep learning.'}
            </p>

            <form onSubmit={submit} className="space-y-3">
              {mode === 'signup' ? (
                <>
                  <input className={inputCls} placeholder="Full name" value={f.displayName} onChange={set('displayName')} autoComplete="name" required />
                  <input className={inputCls} placeholder="Username" value={f.username} onChange={set('username')} autoComplete="username" required />
                  <input className={inputCls} type="email" placeholder="Email" value={f.email} onChange={set('email')} autoComplete="email" required />
                  <select className={inputCls} value={f.subject} onChange={set('subject')}>
                    {MAIN_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <p className="text-[11px] text-[#8e8e8e] -mt-1">Main subject. Not sure yet? Keep "{EXPLORING}" and we'll show you videos from many fields.</p>
                </>
              ) : (
                <input className={inputCls} placeholder="Username or email" value={f.identifier} onChange={set('identifier')} autoComplete="username" required />
              )}
              <input className={inputCls} type="password" placeholder="Password" value={f.password} onChange={set('password')} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required maxLength={128} />
              {mode === 'signup' && <p className="text-[11px] text-[#8e8e8e] -mt-1">At least 8 characters with letters and numbers.</p>}

              {error && <p role="alert" className="text-xs text-[#dc2626] bg-[#fef2f2] border border-[#fca5a5] rounded-lg px-3 py-2">{error}</p>}

              <button disabled={busy} className="w-full py-2.5 bg-[#7c3aed] text-white text-sm font-semibold rounded-lg hover:bg-[#6d28d9] transition disabled:opacity-60">
                {busy ? 'Please wait...' : mode === 'signup' ? 'Sign up' : 'Log in'}
              </button>
            </form>
          </div>

          <div className="bg-white border border-[#dbdbdb] rounded-2xl p-4 mt-3 text-center text-sm text-[#262626]">
            {mode === 'signup' ? 'Have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); }} className="font-semibold text-[#7c3aed] hover:underline">
              {mode === 'signup' ? 'Log in' : 'Sign up'}
            </button>
          </div>
          <p className="text-[11px] text-[#8e8e8e] text-center mt-4">
            By continuing you agree to our <a href="/terms.html" target="_blank" rel="noreferrer" className="underline">Terms</a> and <a href="/privacy.html" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
