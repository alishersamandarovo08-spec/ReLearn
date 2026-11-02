import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { timeAgo } from '../lib/format';
import { useNav } from '../lib/nav';
import { Avatar, EmptyState } from './ui';

export default function MessagesPanel() {
  const { me, users, messages, userById, sendMessage, markConversationRead, canMessage } = useStore();
  const { chatId } = useNav();
  const [activeId, setActiveId] = useState<string | null>(chatId);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState(false);
  const [sendError, setSendError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const mineMsgs = messages.filter(m => m.fromId === me!.id || m.toId === me!.id);
  const partnerIds = [...new Set(mineMsgs.map(m => (m.fromId === me!.id ? m.toId : m.fromId)))];
  const convos = partnerIds
    .map(id => {
      const thread = mineMsgs.filter(m => m.fromId === id || m.toId === id).sort((a, b) => a.createdAt - b.createdAt);
      return { id, thread, last: thread[thread.length - 1], unread: thread.filter(m => m.toId === me!.id && !m.read).length };
    })
    .sort((a, b) => b.last.createdAt - a.last.createdAt);

  const active = activeId ? userById(activeId) : undefined;
  const thread = activeId ? mineMsgs.filter(m => m.fromId === activeId || m.toId === activeId).sort((a, b) => a.createdAt - b.createdAt) : [];

  useEffect(() => {
    if (activeId) markConversationRead(activeId);
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [activeId, thread.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !text.trim()) return;
    const err = sendMessage(activeId, text);
    setSendError(err ?? '');
    if (!err) setText('');
  }

  const candidates = users.filter(u => canMessage(u.id) && (!q.trim() || [u.username, u.displayName].some(v => v.toLowerCase().includes(q.trim().toLowerCase())))).slice(0, 8);

  return (
    <div className="max-w-[935px] mx-auto md:pt-6 pb-14 md:pb-6 md:px-4 h-[calc(100vh-56px)] md:h-screen">
      <div className="bg-white md:border border-[#dbdbdb] md:rounded-xl h-full flex overflow-hidden">
        <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] flex-col border-r border-[#dbdbdb]`}>
          <div className="flex items-center justify-between px-5 h-14 border-b border-[#dbdbdb]">
            <h1 className="text-base font-bold text-[#262626]">{me!.username}</h1>
            <button onClick={() => setComposing(v => !v)} aria-label="New message" className="text-[#262626] hover:text-[#7c3aed] transition">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
          </div>

          {composing && (
            <div className="p-3 border-b border-[#dbdbdb] bg-[#fafafa]">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search people..." className="w-full text-sm bg-white border border-[#dbdbdb] rounded-lg px-3 py-2 outline-none focus:border-[#7c3aed]" />
              <div className="mt-2 max-h-48 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="text-xs text-[#8e8e8e] p-2">Follow someone (or get followed) to message them.</p>
                ) : candidates.map(u => (
                  <button key={u.id} onClick={() => { setActiveId(u.id); setComposing(false); setQ(''); }} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white text-left">
                    <Avatar user={u} size={32} />
                    <span className="text-sm"><b className="font-semibold">{u.username}</b> <span className="text-[#8e8e8e]">{u.displayName}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {convos.length === 0 ? (
              <EmptyState title="Your messages" body="Send a private message to a study partner." action={<button onClick={() => setComposing(true)} className="px-4 py-2 bg-[#7c3aed] text-white text-sm font-semibold rounded-lg">Send message</button>} />
            ) : convos.map(c => {
              const u = userById(c.id);
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)} className={`w-full flex items-center gap-3 px-5 py-3 text-left transition ${activeId === c.id ? 'bg-[#f0ebff]' : 'hover:bg-[#fafafa]'}`}>
                  <Avatar user={u} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#262626] truncate">{u?.displayName}</p>
                    <p className={`text-xs truncate ${c.unread ? 'font-semibold text-[#262626]' : 'text-[#8e8e8e]'}`}>
                      {c.last.fromId === me!.id && 'You: '}{c.last.text} · {timeAgo(c.last.createdAt)}
                    </p>
                  </div>
                  {c.unread > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#0095f6]" aria-label="Unread" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {active ? (
            <>
              <div className="flex items-center gap-3 px-4 h-14 border-b border-[#dbdbdb]">
                <button onClick={() => setActiveId(null)} aria-label="Back" className="md:hidden text-[#262626]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <Avatar user={active} size={32} />
                <div><p className="text-sm font-semibold text-[#262626] leading-tight">{active.displayName}</p><p className="text-xs text-[#8e8e8e]">@{active.username}</p></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {thread.length === 0 && <p className="text-center text-xs text-[#8e8e8e] mt-10">Say hi to {active.displayName}.</p>}
                {thread.map(m => (
                  <div key={m.id} className={`flex ${m.fromId === me!.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`${m.fromId === me!.id ? 'message-bubble-me' : 'message-bubble-other'} px-4 py-2 text-sm max-w-[75%] break-words`} title={new Date(m.createdAt).toLocaleString()}>{m.text}</div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              {!canMessage(active.id) ? <p className="p-3 border-t border-[#dbdbdb] text-xs text-[#8e8e8e] text-center">Follow {active.displayName} to send a message.</p> :
              <form onSubmit={send} className="p-3 border-t border-[#dbdbdb] flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} placeholder="Message..." maxLength={1000} aria-label="Message" className="flex-1 bg-[#efefef] rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/30" />
                <button disabled={!text.trim()} className="text-sm font-semibold text-[#0095f6] disabled:text-[#8e8e8e] px-2">Send</button>
              </form>}
              {sendError && <p role="alert" className="text-xs text-[#dc2626] px-4 pb-2">{sendError}</p>}
            </>
          ) : (
            <div className="m-auto"><EmptyState title="Your messages" body="Pick a conversation or start a new one." /></div>
          )}
        </div>
      </div>
    </div>
  );
}
