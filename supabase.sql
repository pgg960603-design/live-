create table if not exists public.ranking_boards (
  board text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ranking_boards enable row level security;
drop policy if exists "ranking read" on public.ranking_boards;
drop policy if exists "ranking write" on public.ranking_boards;
create policy "ranking read" on public.ranking_boards for select using (true);
alter publication supabase_realtime add table public.ranking_boards;
