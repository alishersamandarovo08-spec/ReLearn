-- ReLearn: schema, Row Level Security, storage and realtime.
-- Run in Supabase Dashboard -> SQL Editor (or `supabase db push`). Safe to run more than once.

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  subject text not null default '',
  bio text not null default '' check (char_length(bio) <= 150),
  avatar text check (avatar is null or (avatar like 'data:image/jpeg;base64,%' and char_length(avatar) < 400000)),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  media_path text not null,
  caption text not null default '' check (char_length(caption) <= 2200),
  subject text not null default '',
  tags text[] not null default '{}',
  ai_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);

-- kind: like | save | repost
create table if not exists public.post_actions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('like','save','repost')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  media_path text not null,
  subject text,
  caption text,
  ai jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (story_id, user_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','follow','repost')),
  post_id uuid references public.posts(id) on delete cascade,
  text text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index if not exists messages_to_idx on public.messages (to_id, created_at);
create index if not exists messages_from_idx on public.messages (from_id, created_at);

-- ---------- Functions ----------
-- Create a profile automatically when someone signs up in Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, subject)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', 'user' || substr(replace(new.id::text, '-', ''), 1, 10))),
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), 'Learner'), 50),
    left(coalesce(new.raw_user_meta_data->>'subject', ''), 60)
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Login with username: returns only the e-mail needed to sign in (nothing else).
create or replace function public.email_for_username(p_username text)
returns text language sql security definer stable set search_path = public, auth as $$
  select u.email::text from auth.users u join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username) limit 1;
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- Messaging allowed between mutual-follow-ish pairs (either follows) or existing conversations.
create or replace function public.can_message(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.follows where (follower_id = a and followee_id = b) or (follower_id = b and followee_id = a))
      or exists (select 1 from public.messages where (from_id = a and to_id = b) or (from_id = b and to_id = a));
$$;

revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.can_message(uuid, uuid) to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles      enable row level security;
alter table public.posts         enable row level security;
alter table public.post_actions  enable row level security;
alter table public.comments      enable row level security;
alter table public.stories       enable row level security;
alter table public.story_views   enable row level security;
alter table public.follows       enable row level security;
alter table public.notifications enable row level security;
alter table public.messages      enable row level security;

-- profiles (e-mail lives only in auth.users and is never exposed)
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles delete own" on public.profiles for delete to authenticated using (id = auth.uid());

-- posts
drop policy if exists "posts readable" on public.posts;
create policy "posts readable" on public.posts for select to authenticated using (true);
drop policy if exists "posts insert own" on public.posts;
create policy "posts insert own" on public.posts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete to authenticated using (user_id = auth.uid());

-- likes / saves / reposts
drop policy if exists "actions readable" on public.post_actions;
create policy "actions readable" on public.post_actions for select to authenticated using (user_id = auth.uid() or kind <> 'save');
drop policy if exists "actions insert own" on public.post_actions;
create policy "actions insert own" on public.post_actions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "actions delete own" on public.post_actions;
create policy "actions delete own" on public.post_actions for delete to authenticated using (user_id = auth.uid());

-- comments (author or post owner may delete)
drop policy if exists "comments readable" on public.comments;
create policy "comments readable" on public.comments for select to authenticated using (true);
drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "comments update own" on public.comments;
create policy "comments update own" on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "comments delete own or post owner" on public.comments;
create policy "comments delete own or post owner" on public.comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

-- stories (visible for 24h)
drop policy if exists "stories readable while live" on public.stories;
create policy "stories readable while live" on public.stories for select to authenticated
  using (created_at > now() - interval '24 hours' or user_id = auth.uid());
drop policy if exists "stories insert own" on public.stories;
create policy "stories insert own" on public.stories for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "stories delete own" on public.stories;
create policy "stories delete own" on public.stories for delete to authenticated using (user_id = auth.uid());

drop policy if exists "story views visible to viewer and owner" on public.story_views;
create policy "story views visible to viewer and owner" on public.story_views for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));
drop policy if exists "story views insert own" on public.story_views;
create policy "story views insert own" on public.story_views for insert to authenticated with check (user_id = auth.uid());

-- follows
drop policy if exists "follows readable" on public.follows;
create policy "follows readable" on public.follows for select to authenticated using (true);
drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own" on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- notifications: private to the recipient; anyone may create one only as themselves
drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications insert as actor" on public.notifications;
create policy "notifications insert as actor" on public.notifications for insert to authenticated
  with check (actor_id = auth.uid() and user_id <> auth.uid());
drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- messages: only the two participants can see them
drop policy if exists "messages read participants" on public.messages;
create policy "messages read participants" on public.messages for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists "messages send as self" on public.messages;
create policy "messages send as self" on public.messages for insert to authenticated
  with check (from_id = auth.uid() and public.can_message(from_id, to_id));
drop policy if exists "messages mark read (recipient)" on public.messages;
create policy "messages mark read (recipient)" on public.messages for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid());
drop policy if exists "messages delete own sent" on public.messages;
create policy "messages delete own sent" on public.messages for delete to authenticated using (from_id = auth.uid());

-- ---------- Storage (photos & videos) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 104857600,
  array['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;

drop policy if exists "media upload to own folder" on storage.objects;
create policy "media upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
-- Public bucket: objects are readable through their (unguessable) public URL.

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','posts','post_actions','comments','stories','story_views','follows','notifications','messages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- Backfill: accounts created before this migration ----------
insert into public.profiles (id, username, display_name, subject)
select u.id,
       lower(coalesce(nullif(u.raw_user_meta_data->>'username', ''), 'user' || substr(replace(u.id::text, '-', ''), 1, 10))),
       left(coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), 'Learner'), 50),
       left(coalesce(u.raw_user_meta_data->>'subject', ''), 60)
from auth.users u
on conflict do nothing;
