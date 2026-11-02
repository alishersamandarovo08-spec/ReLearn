import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { Avatar, EmptyState, FollowButton, Media, PlayBadge } from './ui';
import PostCard from './Post';
import { Modal } from './ui';
import type { Post } from '../lib/types';

export function PostGrid({ posts, onOpen }: { posts: Post[]; onOpen: (p: Post) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map(p => (
        <button key={p.id} onClick={() => onOpen(p)} className="relative aspect-square bg-[#efefef] overflow-hidden group" aria-label={p.caption || 'Open post'}>
          <Media blob={p.media} kind={p.kind} controls={false} className="w-full h-full object-cover" />
          {p.kind === 'video' && <PlayBadge />}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-4 text-white text-sm font-semibold opacity-0 group-hover:opacity-100">
            <span>♥ {p.likes.length}</span><span>💬 {p.comments.length}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PostViewer({ post, onClose }: { post: Post; onClose: () => void }) {
  const { posts } = useStore();
  const live = posts.find(p => p.id === post.id);
  if (!live) return null;
  return (
    <Modal title="Post" onClose={onClose} width="max-w-[500px]">
      <div className="max-h-[80vh] overflow-y-auto p-3 bg-[#fafafa]"><PostCard post={live} /></div>
    </Modal>
  );
}

export default function SearchPanel() {
  const { users, posts, me } = useStore();
  const { openProfile } = useNav();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Post | null>(null);
  const term = q.trim().toLowerCase().replace(/^[#@]/, '');

  const matchedUsers = term
    ? users.filter(u => u.id !== me!.id && [u.username, u.displayName, u.subject].some(v => v.toLowerCase().includes(term)))
    : [];
  const matchedPosts = term
    ? posts.filter(p => [p.caption, p.subject, ...p.tags].some(v => v.toLowerCase().includes(term)))
    : posts;

  return (
    <div className="max-w-[935px] mx-auto px-4 pt-6 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-[#262626] mb-4 hidden md:block">Search</h1>
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e8e]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people, subjects or #tags" aria-label="Search"
          className="w-full bg-[#efefef] rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/30 placeholder:text-[#8e8e8e]" />
        {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e8e8e] hover:text-[#262626]">✕</button>}
      </div>

      {term && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-[#262626] mb-3">People</h2>
          {matchedUsers.length === 0 ? (
            <p className="text-sm text-[#8e8e8e]">No people match "{q}".</p>
          ) : (
            <div className="bg-white border border-[#dbdbdb] rounded-xl divide-y divide-[#efefef]">
              {matchedUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => openProfile(u.id)}><Avatar user={u} size={44} /></button>
                  <button onClick={() => openProfile(u.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-[#262626] truncate">{u.username}</p>
                    <p className="text-xs text-[#8e8e8e] truncate">{u.displayName}{u.subject && ` · ${u.subject}`}</p>
                  </button>
                  <FollowButton userId={u.id} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-[#262626] mb-3">{term ? 'Posts' : 'Explore'}</h2>
        {matchedPosts.length === 0 ? (
          <EmptyState title={term ? 'No posts found' : 'Nothing to explore yet'} body={term ? 'Try a different subject or tag.' : 'Posts shared by everyone on ReLearn will appear here.'} />
        ) : (
          <PostGrid posts={matchedPosts} onOpen={setOpen} />
        )}
      </section>
      {open && <PostViewer post={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
