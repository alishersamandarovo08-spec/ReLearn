import { useEffect, useState, type ReactNode } from 'react';
import type { User } from '../lib/types';
import { useStore } from '../lib/store';

const PALETTE = ['#7c3aed', '#4f46e5', '#0ea5e9', '#059669', '#d97706', '#db2777', '#dc2626'];

export function Avatar({ user, size = 32, className = '' }: { user?: Pick<User, 'avatar' | 'username' | 'displayName' | 'id'>; size?: number; className?: string }) {
  if (user?.avatar) {
    return <img src={user.avatar} alt={user.username} style={{ width: size, height: size }} className={`rounded-full object-cover flex-shrink-0 ${className}`} />;
  }
  const seed = (user?.id ?? '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <div
      aria-label={user?.username}
      style={{ width: size, height: size, background: PALETTE[seed % PALETTE.length], fontSize: size * 0.4 }}
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none ${className}`}
    >
      {(user?.displayName || user?.username || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export function useObjectUrl(blob: Blob | string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    if (typeof blob === 'string') { setUrl(blob); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function Media({ blob, kind, className = '', controls = true, autoPlay = false }: { blob: Blob | string; kind: 'image' | 'video'; className?: string; controls?: boolean; autoPlay?: boolean }) {
  const url = useObjectUrl(blob);
  if (!url) return null;
  return kind === 'video' ? (
    <video src={url} controls={controls} autoPlay={autoPlay} loop={autoPlay} playsInline muted={autoPlay} className={className} />
  ) : (
    <img src={url} alt="" className={className} />
  );
}

export function PlayBadge() {
  return (
    <span className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    </span>
  );
}

export function Modal({ title, onClose, children, width = 'max-w-md' }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-label={title} className={`bg-white rounded-2xl overflow-hidden w-full ${width} shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#dbdbdb]">
          <h2 className="text-base font-semibold text-[#262626]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#262626] hover:text-[#8e8e8e] transition">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FollowButton({ userId, className = '' }: { userId: string; className?: string }) {
  return <FollowInner userId={userId} className={className} />;
}
function FollowInner({ userId, className }: { userId: string; className: string }) {
  const { isFollowing, toggleFollow, me } = useStore();
  if (me?.id === userId) return null;
  const f = isFollowing(userId);
  return (
    <button onClick={() => toggleFollow(userId)} className={`text-xs font-semibold transition ${f ? 'text-[#8e8e8e] hover:text-[#262626]' : 'text-[#0095f6] hover:text-[#00376b]'} ${className}`}>
      {f ? 'Following' : 'Follow'}
    </button>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6 text-[#8e8e8e]">
      <div className="w-14 h-14 rounded-full border-2 border-[#dbdbdb] flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
      </div>
      <p className="text-base font-semibold text-[#262626]">{title}</p>
      <p className="text-sm mt-1 max-w-xs mx-auto">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const REASONS: [import('../lib/store').ReportReason, string][] = [
  ['off_topic', 'Not study related'], ['inappropriate', 'Inappropriate or explicit'], ['spam', 'Spam or advertising'],
  ['harassment', 'Harassment or hate'], ['other', 'Something else'],
];

export function ReportModal({ target, onClose }: { target: { postId?: string; userId?: string }; onClose: () => void }) {
  const { report } = useStore();
  const [reason, setReason] = useState<import('../lib/store').ReportReason>('inappropriate');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'form' | 'busy' | 'done'>('form');
  const [error, setError] = useState('');
  async function send() {
    setState('busy'); setError('');
    const err = await report(target, reason, details);
    if (err) { setError(err); setState('form'); } else setState('done');
  }
  return (
    <Modal title="Report" onClose={onClose}>
      <div className="p-5 space-y-3">
        {state === 'done' ? (
          <>
            <p className="text-sm text-[#262626]">Thank you. Your report was sent and will be reviewed.</p>
            <button onClick={onClose} className="w-full py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold">Done</button>
          </>
        ) : (
          <>
            <fieldset className="space-y-2">
              {REASONS.map(([v, label]) => (
                <label key={v} className="flex items-center gap-2 text-sm text-[#262626]"><input type="radio" name="reason" checked={reason === v} onChange={() => setReason(v)} />{label}</label>
              ))}
            </fieldset>
            <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={500} rows={3} placeholder="Add details (optional)" aria-label="Details" className="w-full text-sm border border-[#dbdbdb] rounded-lg px-3 py-2 outline-none focus:border-[#7c3aed] resize-none" />
            {error && <p role="alert" className="text-xs text-[#dc2626]">{error}</p>}
            <button onClick={send} disabled={state === 'busy'} className="w-full py-2 rounded-lg bg-[#ed4956] text-white text-sm font-semibold disabled:opacity-50">{state === 'busy' ? 'Sending…' : 'Send report'}</button>
          </>
        )}
      </div>
    </Modal>
  );
}
