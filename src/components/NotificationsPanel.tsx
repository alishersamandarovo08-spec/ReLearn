import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { timeAgo } from '../lib/format';
import { Avatar, EmptyState, FollowButton, Media } from './ui';
import { PostViewer } from './SearchPanel';
import type { Post } from '../lib/types';

export default function NotificationsPanel() {
  const { me, notifications, posts, userById, markNotificationsRead, canMessage } = useStore();
  const { openProfile, openChat } = useNav();
  const [open, setOpen] = useState<Post | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const mine = notifications.filter(n => n.userId === me!.id).sort((a, b) => b.createdAt - a.createdAt);

  useEffect(() => {
    setFresh(new Set(mine.filter(n => !n.read).map(n => n.id)));
    markNotificationsRead();
  }, []);

  return (
    <div className="max-w-[600px] mx-auto px-4 pt-6 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-[#262626] mb-4 hidden md:block">Notifications</h1>
      {mine.length === 0 ? (
        <div className="bg-white border border-[#dbdbdb] rounded-xl">
          <EmptyState title="No activity yet" body="When someone likes, comments on, reposts your posts or follows you, it shows up here." />
        </div>
      ) : (
        <div className="bg-white border border-[#dbdbdb] rounded-xl divide-y divide-[#efefef] overflow-hidden">
          {mine.map(n => {
            const actor = userById(n.actorId);
            const post = n.postId ? posts.find(p => p.id === n.postId) : undefined;
            return (
              <div key={n.id} className={`flex items-center gap-3 px-4 py-3 ${fresh.has(n.id) ? 'bg-[#f0ebff]' : ''}`}>
                <button onClick={() => openProfile(n.actorId)}><Avatar user={actor} size={44} /></button>
                <p className="flex-1 text-sm text-[#262626] min-w-0 break-words">
                  <button onClick={() => openProfile(n.actorId)} className="font-semibold">{actor?.username}</button>{' '}
                  {n.text} <span className="text-[#8e8e8e] text-xs">{timeAgo(n.createdAt)}</span>
                </p>
                {n.type === 'follow' ? (
                  <div className="flex gap-2">
                    <FollowButton userId={n.actorId} />
                    {canMessage(n.actorId) && <button onClick={() => openChat(n.actorId)} className="px-3 py-1.5 bg-[#efefef] text-sm font-semibold rounded-lg hover:bg-[#dbdbdb]">Message</button>}
                  </div>
                ) : post ? (
                  <button onClick={() => setOpen(post)} aria-label="Open post" className="w-11 h-11 rounded-md overflow-hidden bg-[#efefef] flex-shrink-0">
                    <Media blob={post.media} kind={post.kind} controls={false} className="w-full h-full object-cover" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {open && <PostViewer post={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
