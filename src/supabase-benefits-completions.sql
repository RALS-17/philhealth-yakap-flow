-- Optional remote table for Benefits Programs system (separate from flow_completions)
create table if not exists public.benefits_completions (
  id bigserial primary key,
  patient_name text,
  program_id text,
  program_name text,
  path text,
  site_code text,
  started_at timestamptz,
  created_at timestamptz default now()
);

alter table public.benefits_completions enable row level security;

-- Adjust policies to match your project; example open insert/select for anon if used like flow_completions
