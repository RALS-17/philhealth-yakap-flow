-- ============================================================
-- GCare PhilHealth — recreate tables after accidental DROP
-- Run entire script once in Supabase → SQL Editor → Run
-- ============================================================

-- ---------- 1) flow_completions (Dashboard + Done patients) ----------
create table if not exists public.flow_completions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  flow_name text not null,
  branch text,
  entry_type text,
  site_code text,
  patient_label text,
  path text,
  started_at timestamptz
);

create index if not exists flow_completions_created_at_idx
  on public.flow_completions (created_at desc);

create index if not exists flow_completions_site_code_idx
  on public.flow_completions (site_code);

create index if not exists flow_completions_patient_label_idx
  on public.flow_completions (patient_label)
  where patient_label is not null;

alter table public.flow_completions enable row level security;

drop policy if exists "Allow anon read flow_completions" on public.flow_completions;
drop policy if exists "Allow anon insert flow_completions" on public.flow_completions;
drop policy if exists "Allow anon update flow_completions" on public.flow_completions;
drop policy if exists "Allow anon delete flow_completions" on public.flow_completions;

create policy "Allow anon read flow_completions"
  on public.flow_completions for select to anon using (true);

create policy "Allow anon insert flow_completions"
  on public.flow_completions for insert to anon with check (true);

create policy "Allow anon update flow_completions"
  on public.flow_completions for update to anon using (true) with check (true);

create policy "Allow anon delete flow_completions"
  on public.flow_completions for delete to anon using (true);

-- Also allow authenticated role if used later
drop policy if exists "Allow authenticated all flow_completions" on public.flow_completions;
create policy "Allow authenticated all flow_completions"
  on public.flow_completions for all to authenticated using (true) with check (true);

-- ---------- 2) flow_sessions (Park / resume — multi-device) ----------
create table if not exists public.flow_sessions (
  id uuid primary key,
  label text not null,
  note text,
  site_code text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flow_sessions_updated_at_idx
  on public.flow_sessions (updated_at desc);

create index if not exists flow_sessions_site_code_idx
  on public.flow_sessions (site_code);

alter table public.flow_sessions enable row level security;

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

drop policy if exists "Allow authenticated all flow_sessions" on public.flow_sessions;
create policy "Allow authenticated all flow_sessions"
  on public.flow_sessions for all to authenticated using (true) with check (true);

-- ---------- 3) Optional: expose via realtime (safe to skip) ----------
-- alter publication supabase_realtime add table public.flow_sessions;
-- alter publication supabase_realtime add table public.flow_completions;

-- Done. Dashboard uses flow_completions; Patient List uses flow_sessions + completions with patient_label.
