-- =====================================================================
-- GCare PhilHealth Benefits Programs — Supabase setup for GLOBAL CARE CABUYAO ONLY
-- (this branch has its OWN Supabase project; nothing is shared with other branches)
-- Run this whole file once in: Supabase Dashboard → SQL Editor.
-- Safe to re-run (idempotent).
--
-- What it does
--   1. benefits_profiles   : which branch + role each login belongs to
--   2. benefits_sessions   : paused / in-progress patients   (was missing)
--   3. benefits_completions: finished patients  + UNIQUE key to stop duplicates
--   4. benefits_events     : pause / abandon / finish log (for the Insights page)
--   5. Row-Level Security  : every user can only touch their OWN branch
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES (branch + role per Supabase Auth user)
-- ---------------------------------------------------------------------
create table if not exists public.benefits_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null check (role in ('staff', 'admin')),
  site_code  text not null check (site_code = 'gcmcl'),
  created_at timestamptz not null default now()
);

-- Helper functions used by the policies (SECURITY DEFINER so they can read profiles)
create or replace function public.benefits_my_site()
returns text
language sql stable security definer set search_path = public
as $$ select site_code from public.benefits_profiles where user_id = auth.uid() $$;

create or replace function public.benefits_my_role()
returns text
language sql stable security definer set search_path = public
as $$ select role from public.benefits_profiles where user_id = auth.uid() $$;

revoke all on function public.benefits_my_site() from public;
revoke all on function public.benefits_my_role() from public;
grant execute on function public.benefits_my_site() to authenticated;
grant execute on function public.benefits_my_role() to authenticated;


-- ---------------------------------------------------------------------
-- 2. SESSIONS (paused / in-progress patients)
-- ---------------------------------------------------------------------
create table if not exists public.benefits_sessions (
  id         text primary key,
  label      text,
  site_code  text not null,
  snapshot   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists benefits_sessions_site_updated_idx
  on public.benefits_sessions (site_code, updated_at desc);


-- ---------------------------------------------------------------------
-- 3. COMPLETIONS (finished patients)
-- ---------------------------------------------------------------------
create table if not exists public.benefits_completions (
  id           bigserial primary key,
  patient_name text,
  program_id   text,
  program_name text,
  path         text,
  site_code    text,
  started_at   timestamptz,
  created_at   timestamptz default now()
);

-- Clean up older rows so the constraints below can be applied
update public.benefits_completions set started_at   = coalesce(started_at, created_at, now()) where started_at is null;
update public.benefits_completions set patient_name = coalesce(patient_name, 'Patient')       where patient_name is null;
update public.benefits_completions set program_id   = coalesce(program_id, '')                where program_id is null;
update public.benefits_completions set site_code    = coalesce(site_code, 'gcmcc')            where site_code is null;
update public.benefits_completions set created_at   = coalesce(created_at, now())             where created_at is null;

-- Remove exact duplicates that already exist (keeps the oldest row of each group)
delete from public.benefits_completions a
using public.benefits_completions b
where a.id > b.id
  and a.site_code    = b.site_code
  and a.patient_name = b.patient_name
  and a.program_id   = b.program_id
  and a.started_at   = b.started_at;

alter table public.benefits_completions alter column started_at   set not null;
alter table public.benefits_completions alter column patient_name set not null;
alter table public.benefits_completions alter column program_id   set not null;
alter table public.benefits_completions alter column site_code    set not null;
alter table public.benefits_completions alter column created_at   set not null;
alter table public.benefits_completions alter column created_at   set default now();

-- DATABASE-LEVEL DUPLICATE PROTECTION (two devices can no longer insert the same case twice)
create unique index if not exists benefits_completions_unique_case
  on public.benefits_completions (site_code, patient_name, program_id, started_at);

create index if not exists benefits_completions_site_created_idx
  on public.benefits_completions (site_code, created_at desc);


-- ---------------------------------------------------------------------
-- 4. EVENTS (feeds "where staff pause / abandon flows" on the Insights page)
-- ---------------------------------------------------------------------
create table if not exists public.benefits_events (
  id           bigserial primary key,
  site_code    text not null,
  session_id   text,
  event        text not null check (event in ('pause', 'abandon', 'finish', 'reopen')),
  program_id   text,
  program_name text,
  step_index   int,
  created_at   timestamptz not null default now()
);
create index if not exists benefits_events_site_created_idx
  on public.benefits_events (site_code, created_at desc);


-- ---------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.benefits_profiles    enable row level security;
alter table public.benefits_sessions    enable row level security;
alter table public.benefits_completions enable row level security;
alter table public.benefits_events      enable row level security;

-- Remove ANY older policies (including the old open anon ones) so nothing stays exposed
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('benefits_profiles', 'benefits_sessions', 'benefits_completions', 'benefits_events')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Nobody who is not logged in gets anything
revoke all on public.benefits_profiles    from anon;
revoke all on public.benefits_sessions    from anon;
revoke all on public.benefits_completions from anon;
revoke all on public.benefits_events      from anon;

grant select                         on public.benefits_profiles    to authenticated;
grant select, insert, update, delete on public.benefits_sessions    to authenticated;
grant select, insert, update, delete on public.benefits_completions to authenticated;
grant select, insert                 on public.benefits_events      to authenticated;
grant usage, select on sequence public.benefits_completions_id_seq to authenticated;
grant usage, select on sequence public.benefits_events_id_seq      to authenticated;

-- profiles: you can read only your own row. Nobody can write from the app.
create policy profiles_read_own on public.benefits_profiles
  for select to authenticated
  using (user_id = auth.uid());

-- sessions: staff + admin of a branch can fully manage that branch's sessions
create policy sessions_select on public.benefits_sessions
  for select to authenticated
  using (site_code = public.benefits_my_site());
create policy sessions_insert on public.benefits_sessions
  for insert to authenticated
  with check (site_code = public.benefits_my_site());
create policy sessions_update on public.benefits_sessions
  for update to authenticated
  using (site_code = public.benefits_my_site())
  with check (site_code = public.benefits_my_site());
create policy sessions_delete on public.benefits_sessions
  for delete to authenticated
  using (site_code = public.benefits_my_site());

-- completions: own branch only.
--   staff can edit / reopen (update / delete) only within 30 minutes of finishing
--   admin can edit any record of their branch
--   (keep the 30 minutes in sync with COMPLETION_EDIT_WINDOW_MS in benefitsStore.ts)
create policy completions_select on public.benefits_completions
  for select to authenticated
  using (site_code = public.benefits_my_site());
create policy completions_insert on public.benefits_completions
  for insert to authenticated
  with check (site_code = public.benefits_my_site());
create policy completions_update on public.benefits_completions
  for update to authenticated
  using (
    site_code = public.benefits_my_site()
    and (public.benefits_my_role() = 'admin' or created_at > now() - interval '30 minutes')
  )
  with check (site_code = public.benefits_my_site());
create policy completions_delete on public.benefits_completions
  for delete to authenticated
  using (
    site_code = public.benefits_my_site()
    and (public.benefits_my_role() = 'admin' or created_at > now() - interval '30 minutes')
  );

-- events: own branch, append-only
create policy events_select on public.benefits_events
  for select to authenticated
  using (site_code = public.benefits_my_site());
create policy events_insert on public.benefits_events
  for insert to authenticated
  with check (site_code = public.benefits_my_site());


-- =====================================================================
-- 7. CREATE THE LOGINS (do this AFTER running everything above)
--
-- a) Supabase Dashboard → Authentication → Users → "Add user" → "Create new user"
--    Use a STRONG, UNIQUE password per person and tick "Auto Confirm User".
--      benefitsstaff@gcmcl.com     (staff)
--      benefitsadmin@gcmcl.com     (admin)
--
-- b) Then run this to attach each login to this branch + role:
-- =====================================================================
insert into public.benefits_profiles (user_id, email, role, site_code)
select u.id, u.email, v.role, v.site
from auth.users u
join (values
  ('benefitsstaff@gcmcl.com', 'staff', 'gcmcl'),
  ('benefitsadmin@gcmcl.com', 'admin', 'gcmcl')
) as v(email, role, site) on lower(u.email) = v.email
on conflict (user_id) do update
  set role = excluded.role, site_code = excluded.site_code, email = excluded.email;
