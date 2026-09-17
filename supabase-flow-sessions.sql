-- Run once in Supabase → SQL Editor
-- Shared park/resume sessions for GCare PhilHealth guide (all devices)

create table if not exists public.flow_sessions (
  id uuid primary key,
  label text not null,
  note text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flow_sessions_updated_at_idx
  on public.flow_sessions (updated_at desc);

alter table public.flow_sessions enable row level security;

-- Open policies (same pattern as flow_completions with anon key).
-- Tighten later if you add staff login.
drop policy if exists "Allow anon read flow_sessions" on public.flow_sessions;
drop policy if exists "Allow anon insert flow_sessions" on public.flow_sessions;
drop policy if exists "Allow anon update flow_sessions" on public.flow_sessions;
drop policy if exists "Allow anon delete flow_sessions" on public.flow_sessions;

create policy "Allow anon read flow_sessions"
  on public.flow_sessions for select to anon using (true);

create policy "Allow anon insert flow_sessions"
  on public.flow_sessions for insert to anon with check (true);

create policy "Allow anon update flow_sessions"
  on public.flow_sessions for update to anon using (true) with check (true);

create policy "Allow anon delete flow_sessions"
  on public.flow_sessions for delete to anon using (true);
