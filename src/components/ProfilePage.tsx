import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { Avatar, EmptyState, FollowButton, Modal, ReportModal } from './ui';
import { PostGrid, PostViewer } from './SearchPanel';
import { fileToAvatar, formatCount } from '../lib/format';
import { MAIN_SUBJECTS } from '../lib/moderation';
import type { Post, PublicUser } from '../lib/types';

type Tab = 'posts' | 'reposts' | 'saved';

function UserList({ title, ids, onClose }: { title: string; ids: string[]; onClose: () => void }) {
  const { userById } = useStore();
  const { openProfile } = useNav();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="max-h-[60vh] overflow-y-auto">
        {ids.length === 0 && <p className="text-sm text-[#8e8e8e] text-center py-10">Nobody here yet.</p>}
        {ids.map(id => {
          const u = userById(id);
          if (!u) return null;
          return (
            <div key={id} className="flex items-center gap-3 px-5 py-3">
              <button onClick={() => { openProfile(id); onClose(); }}><Avatar user={u} size={40} /></button>
              <button onClick={() => { openProfile(id); onClose(); }} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate">{u.username}</p>
                <p className="text-xs text-[#8e8e8e] truncate">{u.displayName}</p>
              </button>
              <FollowButton userId={id} />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function DeleteAccount({ onClose }: { onClose: () => void }) {
  const { deleteAccount } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true);
    const r = await deleteAccount();
    if (r) { setErr(r); setBusy(false); }
  }
  return (
    <Modal title="Delete account" onClose={onClose}>
      <div className="p-5 space-y-3">
        <p className="text-sm text-[#262626]">This permanently deletes your profile, posts, stories, comments, messages and uploaded media. This cannot be undone.</p>
        <label className="text-xs text-[#8e8e8e] block">Type DELETE to confirm</label>
        <input value={text} onChange={e => setText(e.target.value)} aria-label="Confirmation" className="w-full text-sm border border-[#dbdbdb] rounded-lg px-3 py-2 outline-none focus:border-[#ed4956]" />
        {err && <p role="alert" className="text-xs text-[#dc2626]">{err}</p>}
        <button onClick={go} disabled={text !== 'DELETE' || busy} className="w-full py-2 rounded-lg bg-[#ed4956] text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Deleting…' : 'Delete my account forever'}</button>
      </div>
    </Modal>
  );
}

function EditProfile({ user, onClose }: { user: PublicUser; onClose: () => void }) {
  const { updateProfile } = useStore();
  const [f, setF] = useState({ displayName: user.displayName, username: user.username, bio: user.bio, subject: user.subject, avatar: user.avatar });
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const field = 'w-full text-sm bg-[#fafafa] border border-[#dbdbdb] rounded-lg px-3 py-2.5 outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20';

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setF({ ...f, avatar: await fileToAvatar(file) }); } catch { setErr('Could not read that image.'); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.displayName.trim()) return setErr('Enter your name.');
    const r = await updateProfile({ ...f, displayName: f.displayName.trim(), bio: f.bio.trim() });
    if (r) setErr(r); else onClose();
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form onSubmit={save} className="p-5 space-y-3">
        <div className="flex items-center gap-4">
          <Avatar user={{ ...user, avatar: f.avatar }} size={64} />
          <div className="flex flex-col items-start gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-semibold text-[#0095f6]">Change photo</button>
            {f.avatar && <button type="button" onClick={() => setF({ ...f, avatar: null })} className="text-xs text-[#8e8e8e]">Remove</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
        </div>
        <input className={field} placeholder="Name" value={f.displayName} onChange={e => setF({ ...f, displayName: e.target.value })} />
        <input className={field} placeholder="Username" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} />
        <select className={field} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })}>
          {MAIN_SUBJECTS.map(s => <option key={s}>{s}</option>)}
        </select>
        <textarea className={`${field} resize-none`} rows={3} maxLength={150} placeholder="Bio" value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} />
        {err && <p role="alert" className="text-xs text-[#dc2626]">{err}</p>}
        <button className="w-full py-2.5 bg-[#7c3aed] text-white text-sm font-semibold rounded-lg hover:bg-[#6d28d9] transition">Save</button>
      </form>
    </Modal>
  );
}

export default function ProfilePage() {
  const { me, posts, follows, userById, logOut, canMessage } = useStore();
  const { profileId, setCreateOpen, openChat } = useNav();
  const [tab, setTab] = useState<Tab>('posts');
  const [open, setOpen] = useState<Post | null>(null);
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);

  const user = userById(profileId ?? me!.id);
  if (!user) return <EmptyState title="Profile not found" body="This account no longer exists." />;
  const own = user.id === me!.id;

  const followerIds = follows.filter(f => f.followeeId === user.id).map(f => f.followerId);
  const followingIds = follows.filter(f => f.followerId === user.id).map(f => f.followeeId);
  const userPosts = posts.filter(p => p.userId === user.id).sort((a, b) => b.createdAt - a.createdAt);
  const reposts = posts.filter(p => p.reposts.includes(user.id));
  const saved = own ? posts.filter(p => p.saves.includes(me!.id)) : [];
  const grid = tab === 'posts' ? userPosts : tab === 'reposts' ? reposts : saved;
  const tabs: Tab[] = own ? ['posts', 'reposts', 'saved'] : ['posts', 'reposts'];

  return (
    <div className="max-w-[935px] mx-auto pt-8 pb-24 md:pb-8 px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-14 mb-10">
        <div className="story-ring flex-shrink-0"><div className="bg-white rounded-full p-[3px]"><Avatar user={user} size={120} /></div></div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-xl font-normal text-[#262626]">{user.username}</h1>
            {own ? (
              <>
                <button onClick={() => setEditing(true)} className="px-4 py-1.5 bg-[#efefef] text-sm font-semibold rounded-lg hover:bg-[#dbdbdb] transition">Edit profile</button>
                <button onClick={logOut} className="px-4 py-1.5 bg-[#efefef] text-sm font-semibold rounded-lg hover:bg-[#dbdbdb] transition">Log out</button>
                <button onClick={() => setDeleting(true)} className="px-4 py-1.5 text-[#ed4956] text-sm font-semibold rounded-lg hover:bg-[#fef2f2] transition">Delete account</button>
              </>
            ) : (
              <>
                <FollowButton userId={user.id} className="!text-sm px-5 py-1.5 rounded-lg bg-[#0095f6] !text-white hover:!bg-[#0080d6]" />
                <button onClick={() => openChat(user.id)} disabled={!canMessage(user.id)} title={canMessage(user.id) ? '' : 'Follow to message'} className="px-4 py-1.5 bg-[#efefef] text-sm font-semibold rounded-lg hover:bg-[#dbdbdb] transition disabled:opacity-50 disabled:cursor-not-allowed">Message</button>
                <button onClick={() => setReporting(true)} className="px-4 py-1.5 text-[#ed4956] text-sm font-semibold rounded-lg hover:bg-[#fef2f2] transition">Report</button>
              </>
            )}
          </div>
          <div className="flex gap-8 mb-4 text-sm">
            <span><b className="font-semibold">{formatCount(userPosts.length)}</b> posts</span>
            <button onClick={() => setList('followers')}><b className="font-semibold">{formatCount(followerIds.length)}</b> followers</button>
            <button onClick={() => setList('following')}><b className="font-semibold">{formatCount(followingIds.length)}</b> following</button>
          </div>
          <p className="text-sm font-semibold text-[#262626]">{user.displayName}</p>
          {user.subject && <p className="text-xs text-[#7c3aed] font-medium mt-0.5">{user.subject}</p>}
          {user.bio && <p className="text-sm text-[#262626] mt-1 whitespace-pre-wrap">{user.bio}</p>}
        </div>
      </div>

      <div className="border-t border-[#dbdbdb] flex justify-center gap-12" role="tablist">
        {tabs.map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`py-3 text-xs font-semibold uppercase tracking-widest border-t -mt-px transition ${tab === t ? 'border-[#262626] text-[#262626]' : 'border-transparent text-[#8e8e8e] hover:text-[#262626]'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {grid.length === 0 ? (
          <EmptyState
            title={tab === 'posts' ? (own ? 'Share your first study post' : 'No posts yet') : tab === 'reposts' ? 'No reposts' : 'Nothing saved'}
            body={tab === 'posts' ? (own ? 'Upload a photo or video of your notes to get started.' : `${user.displayName} hasn't posted yet.`) : tab === 'reposts' ? 'Reposted posts appear here.' : 'Save posts with the bookmark to find them later.'}
            action={tab === 'posts' && own ? <button onClick={() => setCreateOpen(true)} className="px-5 py-2 bg-[#7c3aed] text-white text-sm font-semibold rounded-lg hover:bg-[#6d28d9] transition">Create post</button> : undefined}
          />
        ) : (
          <PostGrid posts={grid} onOpen={setOpen} />
        )}
      </div>

      {open && <PostViewer post={open} onClose={() => setOpen(null)} />}
      {list && <UserList title={list === 'followers' ? 'Followers' : 'Following'} ids={list === 'followers' ? followerIds : followingIds} onClose={() => setList(null)} />}
      {deleting && <DeleteAccount onClose={() => setDeleting(false)} />}
      {reporting && <ReportModal target={{ userId: user.id }} onClose={() => setReporting(false)} />}
      {editing && <EditProfile user={user} onClose={() => setEditing(false)} />}
    </div>
  );
}
