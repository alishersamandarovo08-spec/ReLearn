import { useState } from 'react';
import type { Post as PostType } from '../lib/types';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { formatCount, timeAgo } from '../lib/format';
import { Avatar, Media, ReportModal } from './ui';

const ic = { width: 24, height: 24, viewBox: '0 0 24 24', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export default function Post({ post }: { post: PostType }) {
  const { me, userById, toggleLike, toggleSave, toggleRepost, addComment, deleteComment, deletePost, toggleFollow, isFollowing } = useStore();
  const { openProfile } = useNav();
  const [showComments, setShowComments] = useState(false);
  const [input, setInput] = useState('');
  const [pop, setPop] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentError, setCommentError] = useState('');

  const author = userById(post.userId);
  const liked = post.likes.includes(me!.id);
  const saved = post.saves.includes(me!.id);
  const reposted = post.reposts.includes(me!.id);
  const mine = post.userId === me!.id;

  function like() {
    setPop(true);
    setTimeout(() => setPop(false), 300);
    toggleLike(post.id);
  }

  async function share() {
    const text = `${author?.username}: ${post.caption}`;
    try {
      if (navigator.share) await navigator.share({ title: 'ReLearn', text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* cancelled */ }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const err = addComment(post.id, input);
    setCommentError(err ?? '');
    if (err) return;
    setInput('');
    setShowComments(true);
  }

  return (
    <article className="bg-white border border-[#dbdbdb] rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => openProfile(post.userId)} className="flex items-center gap-3 text-left">
          <Avatar user={author} size={32} />
          <div>
            <p className="text-sm font-semibold text-[#262626] leading-tight">{author?.username ?? 'deleted user'}</p>
            <p className="text-xs text-[#8e8e8e]">{timeAgo(post.createdAt)}{post.subject && ` · ${post.subject}`}</p>
          </div>
        </button>
        <div className="flex items-center gap-2 relative">
          {post.aiVerified && (
            <span className="ai-badge-bg text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">AI Verified</span>
          )}
          <button onClick={() => setMenu(v => !v)} aria-label="More options" className="text-[#8e8e8e] hover:text-[#262626] transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-8 z-20 bg-white border border-[#dbdbdb] rounded-xl shadow-lg w-44 py-1 text-sm">
                {mine ? (
                  <button onClick={() => { if (confirm('Delete this post?')) deletePost(post.id); setMenu(false); }} className="w-full text-left px-4 py-2 text-[#ed4956] font-semibold hover:bg-[#fafafa]">Delete post</button>
                ) : (
                  <button onClick={() => { toggleFollow(post.userId); setMenu(false); }} className="w-full text-left px-4 py-2 font-semibold hover:bg-[#fafafa]">
                    {isFollowing(post.userId) ? 'Unfollow' : 'Follow'}
                  </button>
                )}
                {!mine && <button onClick={() => { setReporting(true); setMenu(false); }} className="w-full text-left px-4 py-2 text-[#ed4956] font-semibold hover:bg-[#fafafa]">Report</button>}
                <button onClick={() => { openProfile(post.userId); setMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-[#fafafa]">View profile</button>
                <button onClick={() => setMenu(false)} className="w-full text-left px-4 py-2 hover:bg-[#fafafa]">Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative bg-black" onDoubleClick={() => !liked && like()}>
        <Media blob={post.media} kind={post.kind} className="w-full max-h-[585px] object-contain bg-[#efefef] min-h-[200px]" />
      </div>

      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button onClick={like} aria-label={liked ? 'Unlike' : 'Like'} className={`transition-transform active:scale-90 ${pop ? 'like-pop' : ''}`}>
              <svg {...ic} fill={liked ? '#ed4956' : 'none'} stroke={liked ? '#ed4956' : 'currentColor'}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            </button>
            <button onClick={() => setShowComments(v => !v)} aria-label="Comment" className="text-[#262626] hover:text-[#8e8e8e] transition">
              <svg {...ic} fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </button>
            <button onClick={() => toggleRepost(post.id)} aria-label="Repost" className={reposted ? 'text-[#7c3aed]' : 'text-[#262626] hover:text-[#8e8e8e] transition'}>
              <svg {...ic} fill="none" stroke="currentColor"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
            </button>
            <button onClick={share} aria-label="Share" className="text-[#262626] hover:text-[#8e8e8e] transition relative">
              <svg {...ic} fill="none" stroke="currentColor"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              {copied && <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#262626] text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">Copied</span>}
            </button>
          </div>
          <button onClick={() => toggleSave(post.id)} aria-label={saved ? 'Unsave' : 'Save'} className="text-[#262626] hover:text-[#8e8e8e] transition">
            <svg {...ic} fill={saved ? 'currentColor' : 'none'} stroke="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>

        <p className="text-sm font-semibold text-[#262626] mb-1">
          {formatCount(post.likes.length)} {post.likes.length === 1 ? 'like' : 'likes'}
          {post.reposts.length > 0 && <span className="font-normal text-[#8e8e8e]"> · {post.reposts.length} {post.reposts.length === 1 ? 'repost' : 'reposts'}</span>}
        </p>

        {post.caption && (
          <p className="text-sm text-[#262626] leading-relaxed mb-1 whitespace-pre-wrap break-words">
            <span className="font-semibold mr-1">{author?.username}</span>
            {expanded || post.caption.length <= 120 ? post.caption : `${post.caption.slice(0, 120)}...`}
            {!expanded && post.caption.length > 120 && (
              <button onClick={() => setExpanded(true)} className="text-[#8e8e8e] ml-1">more</button>
            )}
          </p>
        )}
        {post.tags.length > 0 && <p className="text-sm text-[#0095f6] mb-2">{post.tags.map(t => `#${t}`).join(' ')}</p>}

        {post.comments.length > 0 && (
          <button onClick={() => setShowComments(v => !v)} className="text-sm text-[#8e8e8e] hover:text-[#262626] transition mb-1 block">
            {showComments ? 'Hide comments' : `View all ${post.comments.length} comments`}
          </button>
        )}
        {showComments && (
          <div className="space-y-2 mb-2">
            {post.comments.map(c => {
              const u = userById(c.userId);
              return (
                <div key={c.id} className="flex items-start gap-2 group">
                  <Avatar user={u} size={24} className="mt-0.5" />
                  <div className="flex-1 min-w-0 text-xs text-[#262626] break-words">
                    <button onClick={() => openProfile(c.userId)} className="font-semibold">{u?.username}</button>
                    <span className="ml-1">{c.text}</span>
                    <span className="text-[10px] text-[#8e8e8e] ml-2">{timeAgo(c.createdAt)}</span>
                  </div>
                  {(c.userId === me!.id || mine) && (
                    <button onClick={() => deleteComment(post.id, c.id)} aria-label="Delete comment" className="text-[10px] text-[#8e8e8e] hover:text-[#ed4956] opacity-0 group-hover:opacity-100 focus:opacity-100">Delete</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-[#dbdbdb] pt-2 mt-1">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Add a comment..." maxLength={500} aria-label="Add a comment" className="flex-1 text-sm text-[#262626] placeholder:text-[#8e8e8e] outline-none bg-transparent py-1" />
          {input.trim() && <button type="submit" className="text-sm font-semibold text-[#0095f6] hover:text-[#00376b] transition">Post</button>}
        </form>
        {commentError && <p role="alert" className="text-xs text-[#dc2626] mt-1">{commentError}</p>}
      </div>
      {reporting && <ReportModal target={{ postId: post.id }} onClose={() => setReporting(false)} />}
    </article>
  );
}
