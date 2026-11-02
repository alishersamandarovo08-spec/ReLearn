import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import type { Story } from '../lib/types';
import { Avatar, Media, Modal } from './ui';
import { MAIN_SUBJECTS, EXPLORING } from '../lib/moderation';
import { checkContent, onAiProgress, warmUpAi } from '../lib/ai-check';
import type { AiResult } from '../lib/moderation';
import { timeAgo } from '../lib/format';

function StoryViewer({ stories, onClose }: { stories: Story[]; onClose: () => void }) {
  const { userById, viewStory } = useStore();
  const [i, setI] = useState(0);
  const story = stories[i];
  const user = userById(story.userId);

  useEffect(() => { viewStory(story.id); }, [story.id]);
  useEffect(() => {
    if (story.kind === 'video') return;
    const t = setTimeout(() => (i < stories.length - 1 ? setI(i + 1) : onClose()), 5000);
    return () => clearTimeout(t);
  }, [i]);

  const next = () => (i < stories.length - 1 ? setI(i + 1) : onClose());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center story-viewer-overlay" onClick={onClose}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {stories.map((s, idx) => <div key={s.id} className={`h-0.5 flex-1 rounded-full ${idx <= i ? 'bg-white' : 'bg-white/30'}`} />)}
        </div>
        <div className="absolute top-6 left-3 right-3 flex items-center gap-2 z-10">
          <Avatar user={user} size={32} className="border-2 border-white" />
          <span className="text-white text-sm font-semibold">{user?.username}</span>
          <span className="text-white/70 text-xs">{timeAgo(story.createdAt)}</span>
          <button onClick={onClose} aria-label="Close story" className="ml-auto text-white hover:text-white/70">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <Media key={story.id} blob={story.media} kind={story.kind} autoPlay controls={false} className="w-full h-full object-contain" />
        {(story.caption || story.subject || story.ai) && (
          <div className="absolute bottom-3 left-3 right-3 z-10 text-white text-xs space-y-1 pointer-events-none">
            {story.caption && <p className="bg-black/50 rounded-lg px-3 py-2 text-sm">{story.caption}</p>}
            <div className="flex gap-1.5 flex-wrap">
              {story.subject && <span className="bg-black/50 rounded-full px-2 py-0.5">{story.subject}</span>}
              {story.ai?.status === 'approved' && <span className="bg-[#16a34a]/80 rounded-full px-2 py-0.5">AI verified</span>}
            </div>
          </div>
        )}
        <button aria-label="Next story" onClick={next} className="absolute inset-y-0 right-0 w-1/2" />
        <button aria-label="Previous story" onClick={() => i > 0 && setI(i - 1)} className="absolute inset-y-0 left-0 w-1/3" />
      </div>
    </div>
  );
}

function StoryComposer({ file, onClose }: { file: File; onClose: () => void }) {
  const { createStory } = useStore();
  const kind = file.type.startsWith('video/') ? 'video' : 'image';
  const [subject, setSubject] = useState(EXPLORING);
  const [caption, setCaption] = useState('');
  const [ai, setAi] = useState<AiResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [progress, setProgress] = useState('');
  useEffect(() => { void warmUpAi().catch(() => {}); onAiProgress(setProgress); return () => onAiProgress(null); }, []);
  // Any edit invalidates the previous verdict: the media, caption and subject must be re-checked together.
  useEffect(() => { setAi(null); }, [caption, subject]);

  async function runCheck() {
    setChecking(true); setError(''); setProgress('Starting AI check…');
    setAi(await checkContent(file, kind, caption, subject === EXPLORING ? '' : subject));
    setChecking(false);
  }

  async function share() {
    if (ai?.status !== 'approved') return;
    setBusy(true);
    const err = await createStory(file, { subject: subject === EXPLORING ? '' : subject, caption, ai });
    setBusy(false);
    if (err) setError(err); else onClose();
  }

  const tone = ai?.status === 'approved' ? 'bg-[#f0fdf4] border-[#86efac] text-[#166534]' : ai?.status === 'rejected' ? 'bg-[#fef2f2] border-[#fca5a5] text-[#b91c1c]' : 'bg-[#fffbeb] border-[#fcd34d] text-[#92400e]';
  return (
    <Modal title="New story" onClose={onClose}>
      <div className="p-5 space-y-3">
        <div className="rounded-xl overflow-hidden bg-black h-56 flex items-center justify-center"><Media blob={file} kind={kind} controls={false} className="max-h-full max-w-full" /></div>
        <div aria-live="polite" className={`text-xs rounded-lg border px-3 py-2 ${checking ? 'bg-[#f5f3ff] border-[#ddd6fe] text-[#5b21b6]' : ai ? tone : 'bg-[#f5f5f5] border-[#dbdbdb] text-[#555]'}`}>
          {checking ? `AI check: ${progress || 'analysing your story…'}` : ai ? <><b>AI check ({ai.status}):</b> {ai.message}{ai.confidence ? ` (${ai.confidence}%)` : ''}{ai.reason ? ` — ${ai.reason}` : ''}</> : 'Add a caption describing the story, then run the AI check. Stories are only shared after approval.'}
        </div>
        <select value={subject} onChange={e => setSubject(e.target.value)} aria-label="Subject" className="w-full text-sm border border-[#dbdbdb] rounded-lg px-3 py-2 bg-white">
          {MAIN_SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={200} placeholder="Add a caption (optional)" aria-label="Caption" className="w-full text-sm border border-[#dbdbdb] rounded-lg px-3 py-2 outline-none focus:border-[#7c3aed]" />
        {error && <p role="alert" className="text-xs text-[#dc2626]">{error}</p>}
        {ai?.status === 'approved'
          ? <button onClick={share} disabled={busy} className="w-full py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Sharing…' : 'Share story'}</button>
          : <button onClick={runCheck} disabled={checking || caption.trim().length < 3} className="w-full py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-semibold disabled:opacity-50">{checking ? 'Checking…' : 'Run AI check'}</button>}
      </div>
    </Modal>
  );
}

export default function Stories() {
  const { stories, me, userById, isFollowing } = useStore();
  const [pending, setPending] = useState<File | null>(null);
  const [open, setOpen] = useState<Story[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [storyError, setStoryError] = useState('');

  const visibleUserIds = [...new Set(stories.filter(s => s.userId !== me!.id && isFollowing(s.userId)).map(s => s.userId))];
  const mine = stories.filter(s => s.userId === me!.id).sort((a, b) => a.createdAt - b.createdAt);
  const seen = (list: Story[]) => list.every(s => s.viewedBy.includes(me!.id));

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStoryError('');
    setPending(file);
  }

  return (
    <>
      <div className="bg-white border border-[#dbdbdb] rounded-xl p-4 mb-4">
        <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="relative">
              <button onClick={() => (mine.length ? setOpen(mine) : fileRef.current?.click())} aria-label="Your story" className={mine.length ? (seen(mine) ? 'story-ring-seen' : 'story-ring') : 'p-[2px]'}>
                <span className="block bg-white rounded-full p-[2px]"><Avatar user={me!} size={56} /></span>
              </button>
              <button onClick={() => fileRef.current?.click()} aria-label="Add to your story" className="absolute bottom-0 right-0 w-5 h-5 bg-[#0095f6] rounded-full border-2 border-white flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
            </div>
            <span className="text-[11px] text-[#262626]">Your story</span>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
          </div>

          {visibleUserIds.map(id => {
            const list = stories.filter(s => s.userId === id).sort((a, b) => a.createdAt - b.createdAt);
            const u = userById(id);
            return (
              <button key={id} onClick={() => setOpen(list)} className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
                <div className={`${seen(list) ? 'story-ring-seen' : 'story-ring'} transition-all group-hover:scale-105`}>
                  <div className="bg-white rounded-full p-[2px]"><Avatar user={u} size={56} /></div>
                </div>
                <span className="text-[11px] text-[#262626] max-w-[64px] truncate">{u?.username}</span>
              </button>
            );
          })}
        </div>
        {storyError && <p role="alert" className="text-xs text-[#dc2626] mt-3">{storyError}</p>}
        {visibleUserIds.length === 0 && <p className="text-xs text-[#8e8e8e] mt-3">Stories from people you follow show up here for 24 hours.</p>}
      </div>
      {pending && <StoryComposer file={pending} onClose={() => setPending(null)} />}
      {open && <StoryViewer stories={open} onClose={() => setOpen(null)} />}
    </>
  );
}
