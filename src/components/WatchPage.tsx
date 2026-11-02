import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { formatCount } from '../lib/format';
import { SUBJECT_TAGS, EXPLORING } from '../lib/moderation';
import { Avatar, EmptyState, FollowButton, useObjectUrl } from './ui';
import { PostViewer } from './SearchPanel';
import type { Post } from '../lib/types';

function Reel({ post, active, muted, onToggleMute, onComments }: { post: Post; active: boolean; muted: boolean; onToggleMute: () => void; onComments: () => void }) {
  const { me, userById, toggleLike, toggleSave } = useStore();
  const { openProfile } = useNav();
  const url = useObjectUrl(post.media);
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const author = userById(post.userId);
  const liked = post.likes.includes(me!.id);
  const saved = post.saves.includes(me!.id);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active) { v.play().then(() => setPaused(false)).catch(() => setPaused(true)); }
    else { v.pause(); v.currentTime = 0; }
  }, [active, url]);

  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  }

  const btn = 'flex flex-col items-center gap-1 text-white text-xs font-semibold drop-shadow';
  return (
    <div className="h-full snap-start snap-always flex items-center justify-center p-0 sm:py-3">
      <div className="relative h-full w-full sm:max-w-[400px] sm:rounded-2xl overflow-hidden bg-black">
        {url && <video ref={video} src={url} loop playsInline muted={muted} onClick={toggle} className="w-full h-full object-contain cursor-pointer" />}
        {paused && active && (
          <button onClick={toggle} aria-label="Play" className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/50 flex items-center justify-center text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}
        <button onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className="absolute top-14 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" />{muted ? <><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}</svg>
        </button>

        <div className="absolute right-3 bottom-24 flex flex-col gap-5">
          <button onClick={() => toggleLike(post.id)} aria-label={liked ? 'Unlike' : 'Like'} className={btn}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill={liked ? '#ed4956' : 'none'} stroke={liked ? '#ed4956' : 'white'} strokeWidth="2" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            {formatCount(post.likes.length)}
          </button>
          <button onClick={onComments} aria-label="Comments" className={btn}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {formatCount(post.comments.length)}
          </button>
          <button onClick={() => toggleSave(post.id)} aria-label={saved ? 'Unsave' : 'Save'} className={btn}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill={saved ? 'white' : 'none'} stroke="white" strokeWidth="2" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            Save
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 pt-16 pr-20 bg-gradient-to-t from-black/80 to-transparent text-white">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => openProfile(post.userId)}><Avatar user={author} size={32} className="border border-white/60" /></button>
            <button onClick={() => openProfile(post.userId)} className="text-sm font-semibold">{author?.username}</button>
            <FollowButton userId={post.userId} className="!text-white border border-white/70 rounded-md px-2 py-0.5 hover:!text-white hover:bg-white/15" />
          </div>
          {post.caption && <p className="text-sm leading-snug line-clamp-3 break-words">{post.caption}</p>}
          {post.subject && <span className="inline-block mt-2 text-[11px] font-semibold bg-white/20 rounded-full px-2.5 py-0.5">{post.subject}</span>}
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  const { posts, me } = useStore();
  const { setCreateOpen } = useNav();
  const [filter, setFilter] = useState<string>('All');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [comments, setComments] = useState<Post | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const interest = me!.subject && me!.subject !== EXPLORING ? me!.subject : null;
  const reels = useMemo(() => {
    const vids = posts.filter(p => p.kind === 'video' && (filter === 'All' || p.subject === filter));
    return vids.sort((a, b) => Number(interest ? b.subject === interest : 0) - Number(interest ? a.subject === interest : 0) || b.createdAt - a.createdAt);
  }, [posts, filter, interest]);

  const ids = reels.map(r => r.id).join(',');
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting && e.intersectionRatio > 0.6) setActiveId((e.target as HTMLElement).dataset.id ?? null); }),
      { root, threshold: [0.6] },
    );
    root.querySelectorAll('[data-id]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);

  const subjects = ['All', ...SUBJECT_TAGS];

  return (
    <div className="relative h-[calc(100dvh-112px)] md:h-screen bg-[#0b0b0f]">
      <div className="absolute top-0 inset-x-0 z-10 flex gap-2 overflow-x-auto px-3 py-3 bg-gradient-to-b from-black/70 to-transparent" style={{ scrollbarWidth: 'none' }}>
        {subjects.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition ${filter === s ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'}`}>{s}</button>
        ))}
      </div>

      {reels.length === 0 ? (
        <div className="h-full flex items-center justify-center bg-white">
          <EmptyState
            title={filter === 'All' ? 'No videos yet' : `No ${filter} videos yet`}
            body="Short videos about science, maths, careers and more will scroll here. Share the first one."
            action={<button onClick={() => setCreateOpen(true)} className="px-5 py-2 bg-[#7c3aed] text-white text-sm font-semibold rounded-lg hover:bg-[#6d28d9] transition">Upload a video</button>}
          />
        </div>
      ) : (
        <div ref={container} className="h-full overflow-y-scroll snap-y snap-mandatory" style={{ scrollbarWidth: 'none' }}>
          {reels.map(p => (
            <div key={p.id} data-id={p.id} className="h-full">
              <Reel post={p} active={activeId === p.id || (activeId === null && p.id === reels[0].id)} muted={muted} onToggleMute={() => setMuted(m => !m)} onComments={() => setComments(p)} />
            </div>
          ))}
        </div>
      )}
      {comments && <PostViewer post={comments} onClose={() => setComments(null)} />}
    </div>
  );
}
