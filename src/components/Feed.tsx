import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import Stories from './Stories';
import PostCard from './Post';
import RightSidebar from './RightSidebar';
import { EmptyState } from './ui';

export default function Feed() {
  const { posts, me, isFollowing } = useStore();
  const { setCreateOpen, go } = useNav();
  const [tab, setTab] = useState<'all' | 'following'>('all');

  const visible = (tab === 'all' ? posts : posts.filter(p => p.userId === me!.id || isFollowing(p.userId))).slice().sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex justify-center gap-0">
      <div className="w-full max-w-[470px] pt-6 pb-20 md:pb-6 px-4 md:px-0">
        <Stories />

        <div className="flex gap-2 mb-4" role="tablist">
          {(['all', 'following'] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`text-sm font-semibold px-4 py-1.5 rounded-full transition ${tab === t ? 'bg-[#7c3aed] text-white' : 'bg-white border border-[#dbdbdb] text-[#262626] hover:bg-[#f0ebff]'}`}>
              {t === 'all' ? 'Everyone' : 'Following'}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="bg-white border border-[#dbdbdb] rounded-xl">
            <EmptyState
              title={tab === 'all' ? 'No posts yet' : 'Nothing from people you follow'}
              body={tab === 'all' ? 'Be the first to share study notes, a diagram or a short explainer video.' : 'Follow classmates from Search to fill your feed.'}
              action={
                <button onClick={() => (tab === 'all' ? setCreateOpen(true) : go('search'))} className="px-5 py-2 bg-[#7c3aed] text-white text-sm font-semibold rounded-lg hover:bg-[#6d28d9] transition">
                  {tab === 'all' ? 'Create a post' : 'Find people'}
                </button>
              }
            />
          </div>
        ) : (
          visible.map(post => <PostCard key={post.id} post={post} />)
        )}
      </div>
      <RightSidebar />
    </div>
  );
}
