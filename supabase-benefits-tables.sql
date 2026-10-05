-- ============================================================
-- Benefits Programs system — SEPARATE from flow tables
-- Run once in Supabase → SQL Editor (same project is OK)
-- Does NOT modify flow_completions or flow_sessions
-- ============================================================

-- 1) Completed program paths (like flow_completions)
create table if not exists public.benefits_completions (
  id bigserial primary key,
  patient_name text,
  program_id text,
  program_name text,
  path text,
  site_code text,
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists benefits_completions_created_at_idx
  on public.benefits_completions (created_at desc);

create index if not exists benefits_completions_site_code_idx
  on public.benefits_completions (site_code);

alter table public.benefits_completions enable row level security;

drop policy if exists "Allow anon read benefits_completions" on public.benefits_completions;
drop policy if exists "Allow anon insert benefits_completions" on public.benefits_completions;

create policy "Allow anon read benefits_completions"
  on public.benefits_completions for select to anon using (true);

create policy "Allow anon insert benefits_completions"
  on public.benefits_completions for insert to anon with check (true);

-- 2) Paused / in-progress sessions (like flow_sessions)
create table if not exists public.benefits_sessions (
  id text primary key,
  label text not null,
  site_code text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists benefits_sessions_updated_at_idx
  on public.benefits_sessions (updated_at desc);

create index if not exists benefits_sessions_site_code_idx
  on public.benefits_sessions (site_code);

alter table public.benefits_sessions enable row level security;

drop policy if exists "Allow anon read benefits_sessions" on public.benefits_sessions;
drop policy if exists "Allow anon insert benefits_sessions" on public.benefits_sessions;
drop policy if exists "Allow anon update benefits_sessions" on public.benefits_sessions;
drop policy if exists "Allow anon delete benefits_sessions" on public.benefits_sessions;

create policy "Allow anon read benefits_sessions"
  on public.benefits_sessions for select to anon using (true);

create policy "Allow anon insert benefits_sessions"
  on public.benefits_sessions for insert to anon with check (true);

create policy "Allow anon update benefits_sessions"
  on public.benefits_sessions for update to anon using (true) with check (true);

create policy "Allow anon delete benefits_sessions"
  on public.benefits_sessions for delete to anon using (true);
