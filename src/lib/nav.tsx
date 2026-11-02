import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PageType } from './types';

interface Nav {
  page: PageType;
  profileId: string | null;
  go: (p: PageType) => void;
  openProfile: (userId: string) => void;
  chatId: string | null;
  openChat: (userId: string) => void;
  createOpen: boolean;
  setCreateOpen: (v: boolean) => void;
}

const Ctx = createContext<Nav | null>(null);
export const useNav = () => useContext(Ctx)!;

export function NavProvider({ meId, children }: { meId: string; children: ReactNode }) {
  const [page, setPage] = useState<PageType>('feed');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  return (
    <Ctx.Provider
      value={{
        page, profileId, createOpen, setCreateOpen, chatId,
        openChat: id => { setChatId(id); setPage('messages'); },
        go: p => { setChatId(null); setPage(p); setProfileId(p === 'profile' ? meId : null); window.scrollTo(0, 0); },
        openProfile: id => { setPage('profile'); setProfileId(id); window.scrollTo(0, 0); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
