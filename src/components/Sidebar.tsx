import type { PageType } from '../lib/types';
import { useStore } from '../lib/store';
import { Avatar } from './ui';

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onCreatePost: () => void;
  notifCount: number;
  msgCount: number;
}

const HomeIcon = ({ filled }: { filled: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 2}>
    <path d="M3 12L12 3l9 9" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 21V12h6v9M5 10v11h14V10" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const BellIcon = ({ filled }: { filled: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const MessageIcon = ({ filled }: { filled: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const CreateIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>
  </svg>
);

const UserIcon = ({ filled }: { filled: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const WatchIcon = ({ filled }: { filled: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M10 8.5v7l6-3.5z" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);

const navItems = [
  { id: 'feed' as PageType, label: 'Home', icon: (active: boolean) => <HomeIcon filled={active} /> },
  { id: 'watch' as PageType, label: 'Watch', icon: (active: boolean) => <WatchIcon filled={active} /> },
  { id: 'search' as PageType, label: 'Search', icon: () => <SearchIcon /> },
  { id: 'notifications' as PageType, label: 'Notifications', icon: (active: boolean) => <BellIcon filled={active} /> },
  { id: 'messages' as PageType, label: 'Messages', icon: (active: boolean) => <MessageIcon filled={active} /> },
  { id: 'profile' as PageType, label: 'Profile', icon: (active: boolean) => <UserIcon filled={active} /> },
];

export default function Sidebar({ currentPage, onNavigate, onCreatePost, notifCount, msgCount }: SidebarProps) {
  const { me, logOut } = useStore();
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full flex-col border-r border-[#dbdbdb] bg-white z-40"
        style={{ width: 'clamp(72px, 15vw, 244px)' }}>
        {/* Logo */}
        <div className="px-3 pt-8 pb-6 xl:px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg ai-badge-bg flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="hidden xl:block text-[15px] font-bold text-[#262626] tracking-tight">ReLearn</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col gap-1 px-3 xl:px-3">
          {navItems.map(({ id, label, icon }) => {
            const active = currentPage === id;
            const badge = id === 'notifications' ? notifCount : id === 'messages' ? msgCount : 0;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`relative flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-150 w-full text-left
                  ${active ? 'bg-[#f0ebff] text-[#7c3aed]' : 'text-[#262626] hover:bg-[#fafafa]'}`}
              >
                <span className={`flex-shrink-0 ${active ? 'text-[#7c3aed]' : ''}`}>{icon(active)}</span>
                <span className={`hidden xl:block text-sm ${active ? 'font-semibold text-[#7c3aed]' : 'font-normal'}`}>{label}</span>
                {badge > 0 && (
                  <span className="absolute left-7 top-2 min-w-[18px] h-[18px] bg-[#ed4956] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Create Post */}
          <button
            onClick={onCreatePost}
            className="flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-150 w-full text-left text-[#262626] hover:bg-[#fafafa]"
          >
            <span className="flex-shrink-0"><CreateIcon /></span>
            <span className="hidden xl:block text-sm font-normal">Create</span>
          </button>
        </nav>

        {/* Bottom User */}
        <div className="p-3 xl:px-3 border-t border-[#dbdbdb] flex flex-col gap-1">
          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-[#fafafa] transition"
          >
            <Avatar user={me!} size={28} />
            <div className="hidden xl:block text-left overflow-hidden">
              <p className="text-xs font-semibold text-[#262626] truncate">{me!.username}</p>
              <p className="text-[11px] text-[#8e8e8e] truncate">{me!.displayName}</p>
            </div>
          </button>
          <button onClick={logOut} aria-label="Log out" className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-[#fafafa] transition text-[#8e8e8e]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            <span className="hidden xl:block text-xs font-medium">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#dbdbdb] z-40 flex items-center justify-around h-14 px-4">
        {navItems.map(({ id, label, icon }) => {
          const active = currentPage === id;
          const badge = id === 'notifications' ? notifCount : id === 'messages' ? msgCount : 0;
          return (
            <button key={id} onClick={() => onNavigate(id)} className="relative flex flex-col items-center" aria-label={label}>
              <span className={active ? 'text-[#7c3aed]' : 'text-[#262626]'}>{icon(active)}</span>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] bg-[#ed4956] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[3px]">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={onCreatePost} className="text-[#262626]" aria-label="Create">
          <CreateIcon />
        </button>
      </nav>
    </>
  );
}
