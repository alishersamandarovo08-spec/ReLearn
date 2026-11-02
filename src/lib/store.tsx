import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  emailForUsername, loadFollows, loadMessages, loadNotifications, loadPosts, loadStories, loadUsers, removeMedia,
  deleteAccountData, subscribeAll, supabase, uploadMedia, usernameAvailable, type TableName,
} from './supabase';
import {
  LIMITS, USERNAME_RE, EMAIL_RE, allow, cleanText, clearFailures, isSafeAvatar, lockRemaining,
  passwordProblem, recordFailure, validateMedia,
} from './security';
import { analyzeContent, EXPLORING, MAIN_SUBJECTS, SUBJECT_TAGS } from './moderation';
import type { Follow, Message, Notification, Post, PublicUser, Story } from './types';

interface Data {
  users: PublicUser[];
  posts: Post[];
  stories: Story[];
  follows: Follow[];
  notifications: Notification[];
  messages: Message[];
  meId: string | null;
}

const empty: Data = { users: [], posts: [], stories: [], follows: [], notifications: [], messages: [], meId: null };
const GENERIC_LOGIN_ERROR = 'Incorrect username/email or password.';

export interface SignUpInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
  subject: string;
}

type Result = string | null;

interface Store extends Data {
  ready: boolean;
  storageError: string | null;
  me: PublicUser | null;
  userById: (id: string) => PublicUser | undefined;
  signUp: (i: SignUpInput) => Promise<Result>;
  logIn: (identifier: string, password: string) => Promise<Result>;
  logOut: () => void;
  updateProfile: (p: Partial<Pick<PublicUser, 'displayName' | 'bio' | 'subject' | 'avatar' | 'username'>>) => Promise<Result>;
  createPost: (p: { file: File; caption: string; subject: string; tags: string[]; aiVerified: boolean }) => Promise<Result>;
  deletePost: (id: string) => void;
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  toggleRepost: (postId: string) => void;
  addComment: (postId: string, text: string) => Result;
  deleteComment: (postId: string, commentId: string) => void;
  toggleFollow: (userId: string) => void;
  isFollowing: (userId: string) => boolean;
  createStory: (file: File, meta: { subject: string; caption: string; ai: Story['ai'] }) => Promise<Result>;
  viewStory: (storyId: string) => void;
  sendMessage: (toId: string, text: string) => Result;
  canMessage: (userId: string) => boolean;
  markConversationRead: (otherId: string) => void;
  markNotificationsRead: () => void;
  report: (t: { postId?: string; userId?: string }, reason: ReportReason, details: string) => Promise<Result>;
  deleteAccount: () => Promise<Result>;
}

export type ReportReason = 'off_topic' | 'inappropriate' | 'spam' | 'harassment' | 'other';

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

const GROUP: Record<TableName, keyof Omit<Data, 'meId'>> = {
  profiles: 'users', posts: 'posts', post_actions: 'posts', comments: 'posts', stories: 'stories',
  story_views: 'stories', follows: 'follows', notifications: 'notifications', messages: 'messages',
};
const LOADERS: Record<keyof Omit<Data, 'meId'>, () => Promise<unknown>> = {
  users: loadUsers, posts: loadPosts, stories: loadStories, follows: loadFollows, notifications: loadNotifications, messages: loadMessages,
};
type Key = keyof typeof LOADERS;

const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

export function StoreProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Data>(empty);
  const [data, setData] = useState<Data>(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const timers = useRef<Partial<Record<Key, ReturnType<typeof setTimeout>>>>({});

  function commit(patch: Partial<Data>) {
    ref.current = { ...ref.current, ...patch };
    setData(ref.current);
  }

  const fail = (msg = 'Could not reach the server. Check your connection and try again.') => (e?: unknown) => {
    if (e) console.error(e);
    setStorageError(msg);
  };

  /** Refresh one slice from Supabase (debounced so bursts of realtime events cost one fetch). */
  function refresh(key: Key, immediate = false) {
    clearTimeout(timers.current[key]);
    const run = () => {
      LOADERS[key]().then(v => { commit({ [key]: v } as Partial<Data>); setStorageError(null); }).catch(fail());
    };
    if (immediate) run(); else timers.current[key] = setTimeout(run, 120);
  }

  /** If an account exists in Auth but has no profile row (e.g. created before the migration), create it. */
  async function ensureProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row, error } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (row) return;
    const m = user.user_metadata ?? {};
    const username = String(m.username ?? `user${user.id.replace(/-/g, '').slice(0, 10)}`).toLowerCase();
    const { error: e2 } = await supabase.from('profiles').insert({
      id: user.id, username, display_name: String(m.display_name ?? 'Learner').slice(0, 50), subject: String(m.subject ?? '').slice(0, 60),
    });
    if (e2) throw new Error(e2.message);
  }

  async function loadAll() {
    const keys = Object.keys(LOADERS) as Key[];
    const results = await Promise.all(keys.map(k => LOADERS[k]()));
    commit(Object.fromEntries(keys.map((k, i) => [k, results[i]])) as Partial<Data>);
  }

  // Session restore + auth state changes (sessions persist in localStorage and auto-refresh).
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    async function enter(userId: string | null) {
      unsub?.(); unsub = null;
      if (!userId) { commit({ ...empty }); return; }
      try {
        await ensureProfile();
        await loadAll();
        if (cancelled) return;
        commit({ meId: userId });
        unsub = subscribeAll(t => refresh(GROUP[t]));
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        fail(/schema cache|does not exist|relation/i.test(msg)
          ? 'The database is not set up yet. Run supabase/migrations/0001_relearn_schema.sql in the Supabase SQL Editor, then reload.'
          : 'Could not load your data from the server.')(e);
        commit({ meId: userId });
      }
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await enter(session?.user.id ?? null);
      if (!cancelled) setReady(true);
    }).catch(() => { if (!cancelled) setReady(true); });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      // Defer: never call Supabase inside this callback synchronously.
      setTimeout(() => { if (!cancelled && (session?.user.id ?? null) !== ref.current.meId) void enter(session?.user.id ?? null); }, 0);
    });
    return () => { cancelled = true; unsub?.(); sub.subscription.unsubscribe(); Object.values(timers.current).forEach(clearTimeout); };
  }, []);

  const meId = () => ref.current.meId;
  const me = data.users.find(u => u.id === data.meId) ?? null;
  const canMsg = (a: string, b: string) =>
    ref.current.follows.some(f => (f.followerId === a && f.followeeId === b) || (f.followerId === b && f.followeeId === a)) ||
    ref.current.messages.some(m => (m.fromId === a && m.toId === b) || (m.fromId === b && m.toId === a));
  const exists = (id: string) => ref.current.users.some(u => u.id === id);

  /** Run a write; on failure surface the error and resync the affected slice from the server. */
  function write(key: Key, op: PromiseLike<{ error: { message: string } | null }>) {
    op.then(({ error }) => {
      if (error) { console.error(error.message); setStorageError('That change could not be saved. Please try again.'); refresh(key, true); }
    }, fail());
  }

  function notify(n: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
    if (n.userId === n.actorId || !exists(n.userId)) return;
    write('notifications', supabase.from('notifications').insert({
      user_id: n.userId, actor_id: n.actorId, type: n.type, post_id: n.postId ?? null, text: n.text,
    }));
  }

  const patchPost = (id: string, fn: (p: Post) => Post) =>
    commit({ posts: ref.current.posts.map(p => (p.id === id ? fn(p) : p)) });

  function toggleAction(postId: string, kind: 'like' | 'save' | 'repost', field: 'likes' | 'saves' | 'reposts') {
    const uid = meId();
    const p = ref.current.posts.find(x => x.id === postId);
    if (!uid || !p) return;
    const had = p[field].includes(uid);
    patchPost(postId, x => ({ ...x, [field]: toggleIn(x[field], uid) }));
    const q = supabase.from('post_actions');
    write('posts', had
      ? q.delete().eq('post_id', postId).eq('user_id', uid).eq('kind', kind)
      : q.insert({ post_id: postId, user_id: uid, kind }));
    if (!had && kind !== 'save') notify({ userId: p.userId, actorId: uid, type: kind, postId, text: kind === 'like' ? 'liked your post.' : 'reposted your post.' });
  }

  const store: Store = {
    ...data,
    ready,
    storageError,
    me,
    userById: id => data.users.find(x => x.id === id),

    async signUp(i) {
      if (!allow('signup', 5, 10 * 60_000)) return 'Too many attempts. Please wait a few minutes and try again.';
      const username = cleanText(i.username, 20).toLowerCase();
      const email = cleanText(i.email, 320).toLowerCase();
      const displayName = cleanText(i.displayName, LIMITS.name);
      const subject = MAIN_SUBJECTS.includes(i.subject) ? i.subject : EXPLORING;
      if (!USERNAME_RE.test(username)) return 'Username must be 3-20 characters: letters, numbers, dots or underscores.';
      if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';
      if (!displayName) return 'Enter your name.';
      const pw = passwordProblem(typeof i.password === 'string' ? i.password : '', username);
      if (pw) return pw;
      if (!(await usernameAvailable(username))) return 'That username is already taken.';
      const { data: res, error } = await supabase.auth.signUp({
        email, password: i.password,
        options: { data: { username, display_name: displayName, subject }, emailRedirectTo: window.location.origin },
      });
      if (error) return /registered|exists/i.test(error.message) ? 'An account with that email already exists.' : error.message;
      if (res.user && res.user.identities?.length === 0) return 'An account with that email already exists.';
      if (!res.session) return 'Account created. Check your email to confirm your address, then log in.';
      return null; // auth listener loads data and signs the user in
    },

    async logIn(identifier, password) {
      const id = cleanText(identifier, 320).toLowerCase();
      if (!id || typeof password !== 'string' || password.length > 128) return GENERIC_LOGIN_ERROR;
      const wait = lockRemaining(id);
      if (wait > 0) return `Too many failed attempts. Try again in ${wait > 60 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`}.`;
      const email = id.includes('@') ? id : await emailForUsername(id);
      const { error } = await supabase.auth.signInWithPassword({ email: email ?? 'nobody@invalid.example', password });
      if (error) {
        if (/confirm/i.test(error.message)) return 'Please confirm your email address first (check your inbox).';
        recordFailure(id);
        return GENERIC_LOGIN_ERROR;
      }
      clearFailures(id);
      return null;
    },

    logOut() {
      commit({ ...empty });
      void supabase.auth.signOut();
    },

    async updateProfile(p) {
      const uid = meId();
      const cur = ref.current.users.find(u => u.id === uid);
      if (!uid || !cur) return 'You are not logged in.';
      const next = { ...cur };
      if (p.displayName !== undefined) {
        next.displayName = cleanText(p.displayName, LIMITS.name);
        if (!next.displayName) return 'Enter your name.';
      }
      if (p.bio !== undefined) next.bio = cleanText(p.bio, LIMITS.bio, { multiline: true });
      if (p.subject !== undefined) next.subject = MAIN_SUBJECTS.includes(p.subject) ? p.subject : '';
      if (p.avatar !== undefined) {
        if (p.avatar !== null && !isSafeAvatar(p.avatar)) return 'That profile photo is not valid.';
        next.avatar = p.avatar;
      }
      if (p.username !== undefined) {
        const un = cleanText(p.username, 20).toLowerCase();
        if (!USERNAME_RE.test(un)) return 'Username must be 3-20 characters: letters, numbers, dots or underscores.';
        if (un !== cur.username && !(await usernameAvailable(un))) return 'That username is already taken.';
        next.username = un;
      }
      const { error } = await supabase.from('profiles').update({
        username: next.username, display_name: next.displayName, bio: next.bio, subject: next.subject, avatar: next.avatar,
      }).eq('id', uid);
      if (error) return /duplicate|unique/i.test(error.message) ? 'That username is already taken.' : 'Could not save your profile.';
      commit({ users: ref.current.users.map(u => (u.id === uid ? next : u)) });
      return null;
    },

    async createPost({ file, caption, subject, tags, aiVerified }) {
      const uid = meId();
      if (!uid) return 'You are not logged in.';
      if (!allow(`post:${uid}`, 10, 10 * 60_000)) return 'You are posting too quickly. Please wait a few minutes.';
      if (aiVerified !== true) return 'This post has not passed the AI content check.';
      const v = await validateMedia(file);
      if (!v.ok) return v.error;
      let path: string | null = null;
      try {
        path = await uploadMedia(uid, v.blob);
        const { error } = await supabase.from('posts').insert({
          user_id: uid, kind: v.info.kind, media_path: path,
          caption: cleanText(caption, LIMITS.caption, { multiline: true }),
          subject: SUBJECT_TAGS.includes(subject) ? subject : '',
          tags: tags.map(t => cleanText(t, 40).replace(/[^\p{L}\p{N}_]/gu, '')).filter(Boolean).slice(0, 15),
          ai_verified: aiVerified === true,
        });
        if (error) throw new Error(error.message);
      } catch (e) {
        console.error(e);
        if (path) void supabase.storage.from('media').remove([path]);
        return 'Could not publish your post. Check your connection and try again.';
      }
      refresh('posts', true);
      return null;
    },

    deletePost(id) {
      const uid = meId();
      const p = ref.current.posts.find(x => x.id === id);
      if (!uid || !p || p.userId !== uid) return;
      commit({ posts: ref.current.posts.filter(x => x.id !== id) });
      if (typeof p.media === 'string') removeMedia(p.media);
      write('posts', supabase.from('posts').delete().eq('id', id));
    },

    toggleLike: postId => toggleAction(postId, 'like', 'likes'),
    toggleSave: postId => toggleAction(postId, 'save', 'saves'),
    toggleRepost: postId => toggleAction(postId, 'repost', 'reposts'),

    addComment(postId, text) {
      const uid = meId();
      const p = ref.current.posts.find(x => x.id === postId);
      if (!uid || !p) return 'This post is no longer available.';
      const clean = cleanText(text, LIMITS.comment, { multiline: true });
      if (!clean) return 'Write something first.';
      if (!allow(`comment:${uid}`, 20, 60_000)) return 'Slow down a little, you are commenting too fast.';
      const id = crypto.randomUUID();
      patchPost(postId, x => ({ ...x, comments: [...x.comments, { id, userId: uid, text: clean, createdAt: Date.now() }] }));
      write('posts', supabase.from('comments').insert({ id, post_id: postId, user_id: uid, text: clean }));
      notify({ userId: p.userId, actorId: uid, type: 'comment', postId, text: `commented: ${clean.slice(0, 60)}` });
      return null;
    },

    deleteComment(postId, commentId) {
      patchPost(postId, x => ({ ...x, comments: x.comments.filter(c => c.id !== commentId) }));
      write('posts', supabase.from('comments').delete().eq('id', commentId)); // RLS: author or post owner only
    },

    isFollowing: userId => data.follows.some(f => f.followerId === data.meId && f.followeeId === userId),

    toggleFollow(userId) {
      const uid = meId();
      if (!uid || userId === uid || !exists(userId)) return;
      if (!allow(`follow:${uid}`, 30, 60_000)) return;
      const existing = ref.current.follows.find(f => f.followerId === uid && f.followeeId === userId);
      if (existing) {
        commit({ follows: ref.current.follows.filter(f => f.id !== existing.id) });
        write('follows', supabase.from('follows').delete().eq('follower_id', uid).eq('followee_id', userId));
      } else {
        commit({ follows: [...ref.current.follows, { id: `${uid}:${userId}`, followerId: uid, followeeId: userId }] });
        write('follows', supabase.from('follows').insert({ follower_id: uid, followee_id: userId }));
        notify({ userId, actorId: uid, type: 'follow', text: 'started following you.' });
      }
    },

    async createStory(file, meta) {
      const uid = meId();
      if (!uid) return 'You are not logged in.';
      if (!allow(`story:${uid}`, 10, 10 * 60_000)) return 'You are adding stories too quickly.';
      const caption = cleanText(meta.caption, 200);
      const text = analyzeContent(caption, meta.subject, 'image');
      if (meta.ai?.status !== 'approved') return 'This story has not passed the AI content check.';
      if (text.status === 'rejected') return text.reason ?? 'This story was flagged as off-topic.';
      const v = await validateMedia(file, LIMITS.storyBytes);
      if (!v.ok) return v.error;
      let path: string | null = null;
      try {
        path = await uploadMedia(uid, v.blob);
        const { error } = await supabase.from('stories').insert({
          user_id: uid, kind: v.info.kind, media_path: path, subject: meta.subject || null, caption: caption || null, ai: meta.ai ?? null,
        });
        if (error) throw new Error(error.message);
      } catch (e) {
        console.error(e);
        if (path) void supabase.storage.from('media').remove([path]);
        return 'Could not publish your story. Check your connection and try again.';
      }
      refresh('stories', true);
      return null;
    },

    viewStory(storyId) {
      const uid = meId();
      const s = ref.current.stories.find(x => x.id === storyId);
      if (!uid || !s || s.viewedBy.includes(uid)) return;
      commit({ stories: ref.current.stories.map(x => (x.id === storyId ? { ...x, viewedBy: [...x.viewedBy, uid] } : x)) });
      write('stories', supabase.from('story_views').upsert({ story_id: storyId, user_id: uid }, { ignoreDuplicates: true }));
    },

    canMessage: userId => !!ref.current.meId && userId !== ref.current.meId && canMsg(ref.current.meId, userId),

    sendMessage(toId, text) {
      const uid = meId();
      if (!uid) return 'You are not logged in.';
      if (toId === uid || !exists(toId)) return 'That person does not exist.';
      if (!canMsg(uid, toId)) return 'Follow this person (or wait for them to follow you) to message them.';
      const clean = cleanText(text, LIMITS.message, { multiline: true });
      if (!clean) return null;
      if (!allow(`msg:${uid}`, 30, 60_000)) return 'You are sending messages too fast.';
      const id = crypto.randomUUID();
      commit({ messages: [...ref.current.messages, { id, fromId: uid, toId, text: clean, createdAt: Date.now(), read: false }] });
      write('messages', supabase.from('messages').insert({ id, from_id: uid, to_id: toId, text: clean }));
      return null;
    },

    markConversationRead(otherId) {
      const uid = meId();
      if (!uid || !ref.current.messages.some(m => m.fromId === otherId && m.toId === uid && !m.read)) return;
      commit({ messages: ref.current.messages.map(m => (m.fromId === otherId && m.toId === uid ? { ...m, read: true } : m)) });
      write('messages', supabase.from('messages').update({ read: true }).eq('from_id', otherId).eq('to_id', uid).eq('read', false));
    },

    markNotificationsRead() {
      const uid = meId();
      if (!uid || !ref.current.notifications.some(n => n.userId === uid && !n.read)) return;
      commit({ notifications: ref.current.notifications.map(n => (n.userId === uid ? { ...n, read: true } : n)) });
      write('notifications', supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false));
    },

    async report(t, reason, details) {
      const uid = meId();
      if (!uid) return 'You are not logged in.';
      if (!t.postId && !t.userId) return 'Nothing to report.';
      if (!allow(`report:${uid}`, 10, 10 * 60_000)) return 'You are sending reports too quickly.';
      const { error } = await supabase.from('reports').insert({
        reporter_id: uid, post_id: t.postId ?? null, reported_user_id: t.userId ?? null, reason, details: cleanText(details, 500, { multiline: true }),
      });
      return error ? 'Could not send your report. Please try again.' : null;
    },

    async deleteAccount() {
      const uid = meId();
      if (!uid) return 'You are not logged in.';
      const err = await deleteAccountData(uid);
      if (err) return 'Could not delete your account. Please try again.';
      commit({ ...empty });
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
