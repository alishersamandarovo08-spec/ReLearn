import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { Avatar, FollowButton } from './ui';

export default function RightSidebar() {
  const { me, users, isFollowing, logOut } = useStore();
  const { openProfile, go } = useNav();
  const suggested = users.filter(u => u.id !== me!.id && !isFollowing(u.id)).slice(0, 5);

  return (
    <aside className="hidden lg:block w-[320px] flex-shrink-0 pt-6 pl-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => go('profile')}><Avatar user={me!} size={44} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#262626] truncate">{me!.username}</p>
          <p className="text-sm text-[#8e8e8e] truncate">{me!.displayName}</p>
        </div>
        <button onClick={logOut} className="text-xs font-semibold text-[#0095f6] hover:text-[#00376b] transition">Log out</button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[#8e8e8e]">Suggested for you</span>
          <button onClick={() => go('search')} className="text-xs font-semibold text-[#262626] hover:text-[#8e8e8e] transition">See all</button>
        </div>
        {suggested.length === 0 ? (
          <p className="text-xs text-[#8e8e8e] leading-relaxed">No one else has joined yet. Invite classmates to sign up and they will appear here.</p>
        ) : (
          <div className="space-y-3">
            {suggested.map(u => (
              <div key={u.id} className="flex items-center gap-3">
                <button onClick={() => openProfile(u.id)}><Avatar user={u} size={32} /></button>
                <button onClick={() => openProfile(u.id)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-[#262626] truncate">{u.username}</p>
                  <p className="text-xs text-[#8e8e8e] truncate">{u.subject || u.displayName}</p>
                </button>
                <FollowButton userId={u.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 text-[10px] text-[#8e8e8e] leading-relaxed">
        <p>© 2026 RELEARN — AI-Powered Academic Platform</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md ai-badge-bg" />
          <span className="text-[10px] text-[#7c3aed] font-medium">AI Content Moderation Active</span>
        </div>
      </div>
    </aside>
  );
}
