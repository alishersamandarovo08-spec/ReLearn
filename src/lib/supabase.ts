import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Comment, Follow, Message, Notification, Post, Story, User } from './types';

// The anon/publishable key is safe in the browser: all access is governed by Row Level Security
// (see supabase/migrations). Never put a service_role key in client code.
const URL = (import.meta.env.VITE_SUPABASE_URL ?? 'https://iuonivcushbnlhclftbb.supabase.co').replace(/\/rest\/v1\/?$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_zfCu_gO0svh0qJuXeRnVCw_rmjITXbU';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'relearn.auth' },
});

export const BUCKET = 'media';
const DAY = 24 * 60 * 60 * 1000;
const ts = (s: string) => new Date(s).getTime();

// ---------- Row shapes ----------
interface ProfileRow { id: string; username: string; display_name: string; subject: string; bio: string; avatar: string | null; created_at: string }
interface PostRow { id: string; user_id: string; kind: 'image' | 'video'; media_path: string; caption: string; subject: string; tags: string[]; ai_verified: boolean; created_at: string }
interface ActionRow { post_id: string; user_id: string; kind: 'like' | 'save' | 'repost' }
interface CommentRow { id: string; post_id: string; user_id: string; text: string; created_at: string }
interface StoryRow { id: string; user_id: string; kind: 'image' | 'video'; media_path: string; subject: string | null; caption: string | null; ai: Story['ai'] | null; created_at: string }
interface ViewRow { story_id: string; user_id: string }
interface FollowRow { follower_id: string; followee_id: string }
interface NotifRow { id: string; user_id: string; actor_id: string; type: Notification['type']; post_id: string | null; text: string; read: boolean; created_at: string }
interface MsgRow { id: string; from_id: string; to_id: string; text: string; read: boolean; created_at: string }

export const mediaUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export const toUser = (r: ProfileRow): User => ({
  id: r.id, username: r.username, displayName: r.display_name, subject: r.subject, bio: r.bio, avatar: r.avatar, createdAt: ts(r.created_at),
});
const toNotification = (r: NotifRow): Notification => ({
  id: r.id, userId: r.user_id, actorId: r.actor_id, type: r.type, postId: r.post_id ?? undefined, text: r.text, read: r.read, createdAt: ts(r.created_at),
});
const toMessage = (r: MsgRow): Message => ({ id: r.id, fromId: r.from_id, toId: r.to_id, text: r.text, read: r.read, createdAt: ts(r.created_at) });

async function must<T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

// ---------- Loaders (one per table so realtime can refresh only what changed) ----------
export const loadUsers = async () => (await must<ProfileRow[]>(supabase.from('profiles').select('*'))).map(toUser);
export const loadFollows = async (): Promise<Follow[]> =>
  (await must<FollowRow[]>(supabase.from('follows').select('*'))).map(r => ({ id: `${r.follower_id}:${r.followee_id}`, followerId: r.follower_id, followeeId: r.followee_id }));
export const loadNotifications = async () =>
  (await must<NotifRow[]>(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200))).map(toNotification);
export const loadMessages = async () =>
  (await must<MsgRow[]>(supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(2000))).map(toMessage);

export async function loadPosts(): Promise<Post[]> {
  const [posts, actions, comments] = await Promise.all([
    must<PostRow[]>(supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(300)),
    must<ActionRow[]>(supabase.from('post_actions').select('post_id,user_id,kind')),
    must<CommentRow[]>(supabase.from('comments').select('*').order('created_at', { ascending: true })),
  ]);
  const by = (kind: ActionRow['kind'], id: string) => actions.filter(a => a.post_id === id && a.kind === kind).map(a => a.user_id);
  return posts.map(p => ({
    id: p.id, userId: p.user_id, kind: p.kind, media: mediaUrl(p.media_path), caption: p.caption, subject: p.subject,
    tags: p.tags ?? [], aiVerified: p.ai_verified, createdAt: ts(p.created_at),
    likes: by('like', p.id), saves: by('save', p.id), reposts: by('repost', p.id),
    comments: comments.filter(c => c.post_id === p.id).map((c): Comment => ({ id: c.id, userId: c.user_id, text: c.text, createdAt: ts(c.created_at) })),
  }));
}

export async function loadStories(): Promise<Story[]> {
  const since = new Date(Date.now() - DAY).toISOString();
  const [stories, views] = await Promise.all([
    must<StoryRow[]>(supabase.from('stories').select('*').gt('created_at', since).order('created_at', { ascending: false })),
    must<ViewRow[]>(supabase.from('story_views').select('story_id,user_id')),
  ]);
  return stories.map(s => ({
    id: s.id, userId: s.user_id, kind: s.kind, media: mediaUrl(s.media_path), createdAt: ts(s.created_at),
    viewedBy: views.filter(v => v.story_id === s.id).map(v => v.user_id),
    subject: s.subject ?? undefined, caption: s.caption ?? undefined, ai: s.ai ?? undefined,
  }));
}

// ---------- Auth helpers ----------
export async function emailForUsername(username: string): Promise<string | null> {
  const { data } = await supabase.rpc('email_for_username', { p_username: username });
  return typeof data === 'string' ? data : null;
}
export async function usernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { p_username: username });
  return error ? true : data === true;
}

// ---------- Storage ----------
export async function uploadMedia(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type.split('/')[1]?.replace('quicktime', 'mov') || 'bin';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
export const removeMedia = (url: string) => {
  const i = url.indexOf(`/${BUCKET}/`);
  if (i >= 0) void supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + BUCKET.length + 2))]);
};

// ---------- Realtime ----------
export type TableName = 'profiles' | 'posts' | 'post_actions' | 'comments' | 'stories' | 'story_views' | 'follows' | 'notifications' | 'messages';
const TABLES: TableName[] = ['profiles', 'posts', 'post_actions', 'comments', 'stories', 'story_views', 'follows', 'notifications', 'messages'];

/** Subscribe to every table; RLS ensures each client only receives rows it may read. */
export function subscribeAll(onChange: (table: TableName) => void): () => void {
  let ch: RealtimeChannel = supabase.channel(`relearn-${crypto.randomUUID()}`);
  for (const t of TABLES) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => onChange(t));
  ch.subscribe();
  return () => { void supabase.removeChannel(ch); };
}

// ---------- Account deletion ----------
/** Remove all of the user's uploaded files, then delete the account (database rows cascade). */
export async function deleteAccountData(userId: string): Promise<string | null> {
  const files = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
  const paths = (files.data ?? []).map(f => `${userId}/${f.name}`);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.rpc('delete_my_account');
  return error ? error.message : null;
}
