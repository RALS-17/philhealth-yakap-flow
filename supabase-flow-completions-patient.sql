-- Run once in Supabase → SQL Editor
-- Extends flow_completions for admin Patient List (Done records)
-- From now on: patient label, path, and start time for duration

alter table public.flow_completions
  add column if not exists patient_label text,
  add column if not exists path text,
  add column if not exists started_at timestamptz;

create index if not exists flow_completions_patient_label_idx
  on public.flow_completions (created_at desc)
  where patient_label is not null;

-- Existing RLS policies for anon insert/select on flow_completions remain unchanged.
