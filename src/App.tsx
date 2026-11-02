import { StoreProvider, useStore } from './lib/store';
import { NavProvider, useNav } from './lib/nav';
import Sidebar from './components/Sidebar';
import Feed from './components/Feed';
import WatchPage from './components/WatchPage';
import SearchPanel from './components/SearchPanel';
import NotificationsPanel from './components/NotificationsPanel';
import MessagesPanel from './components/MessagesPanel';
import ProfilePage from './components/ProfilePage';
import CreatePostModal from './components/CreatePostModal';
import AuthScreen from './components/AuthScreen';

function Shell() {
  const { me, notifications, messages, storageError } = useStore();
  const { page, go, createOpen, setCreateOpen } = useNav();
  const notifCount = notifications.filter(n => n.userId === me!.id && !n.read).length;
  const msgCount = messages.filter(m => m.toId === me!.id && !m.read).length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <Sidebar currentPage={page} onNavigate={go} onCreatePost={() => setCreateOpen(true)} notifCount={notifCount} msgCount={msgCount} />

      <main className="md:ml-[72px] xl:ml-[244px] min-h-screen">
        {storageError && <div role="alert" className="bg-[#fef2f2] text-[#b91c1c] text-xs font-medium px-4 py-2 text-center">{storageError}</div>}
        <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-[#dbdbdb] sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg ai-badge-bg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            </div>
            <span className="text-base font-bold text-[#262626]">ReLearn</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCreateOpen(true)} aria-label="Create" className="text-[#262626]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
            </button>
            <button onClick={() => go('messages')} aria-label="Messages" className="relative text-[#262626]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              {msgCount > 0 && <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] bg-[#ed4956] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[3px]">{msgCount}</span>}
            </button>
          </div>
        </header>

        {page === 'feed' && <Feed />}
        {page === 'watch' && <WatchPage />}
        {page === 'search' && <SearchPanel />}
        {page === 'notifications' && <NotificationsPanel />}
        {page === 'messages' && <MessagesPanel />}
        {page === 'profile' && <ProfilePage />}
      </main>

      {createOpen && <CreatePostModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function Gate() {
  const { ready, me, storageError } = useStore();
  if (!ready) return <div className="min-h-screen flex items-center justify-center text-sm text-[#8e8e8e]">Loading ReLearn...</div>;
  if (!me) return (
    <>
      {storageError && <div role="alert" className="bg-[#fef2f2] text-[#b91c1c] text-xs font-medium px-4 py-2 text-center">{storageError}</div>}
      <AuthScreen />
    </>
  );
  return (
    <NavProvider key={me.id} meId={me.id}>
      <Shell />
    </NavProvider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  );
}
