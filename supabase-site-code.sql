-- Multi-branch site code for GCare PhilHealth program
-- Run once in Supabase SQL Editor

-- Completions: hospital site
alter table public.flow_completions
  add column if not exists site_code text;

create index if not exists flow_completions_site_code_idx
  on public.flow_completions (site_code);

-- Parked sessions: hospital site
alter table public.flow_sessions
  add column if not exists site_code text;

create index if not exists flow_sessions_site_code_idx
  on public.flow_sessions (site_code);
