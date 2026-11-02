-- ReLearn part 2: table privileges, reports and in-app account deletion. Safe to run more than once.

-- Privileges (RLS still decides which rows each user may touch)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function public.email_for_username(text), public.username_available(text) to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- Reports (required by app stores for user-generated content)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('off_topic','inappropriate','spam','harassment','other')),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  check (post_id is not null or reported_user_id is not null)
);
alter table public.reports enable row level security;
drop policy if exists "reports insert own" on public.reports;
create policy "reports insert own" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "reports read own" on public.reports;
create policy "reports read own" on public.reports for select to authenticated using (reporter_id = auth.uid());
grant select, insert on public.reports to authenticated;

-- Permanently delete the calling user's account and everything they own (cascades through all tables).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
