-- 在 Supabase → SQL Editor 执行一次。
-- 公网浏览器只能使用 publishable / anon key，绝不能放 service_role / secret key。
create table if not exists public.body_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists body_entries_user_time_idx on public.body_entries(user_id, recorded_at desc);
alter table public.body_entries enable row level security;
revoke all on public.body_entries from anon, authenticated;
grant select, insert, update, delete on public.body_entries to authenticated;
drop policy if exists "read_own_entries" on public.body_entries;
drop policy if exists "insert_own_entries" on public.body_entries;
drop policy if exists "update_own_entries" on public.body_entries;
drop policy if exists "delete_own_entries" on public.body_entries;
create policy "read_own_entries" on public.body_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert_own_entries" on public.body_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update_own_entries" on public.body_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete_own_entries" on public.body_entries for delete to authenticated using ((select auth.uid()) = user_id);
