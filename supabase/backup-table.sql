-- Run once in the Supabase SQL editor (project: bram). Stores one encrypted
-- snapshot per user. Server sees only ciphertext.
create table if not exists public.backup (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ciphertext     text    not null,
  version        integer not null default 1,
  schema_version integer not null,
  updated_at     timestamptz not null default now()
);
alter table public.backup enable row level security;
create policy "own backup" on public.backup
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
