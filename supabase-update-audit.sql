-- =====================================================================
-- PBUP Benefits — UPDATE 3: audit trail + cancel reasons
-- Run ONCE in EACH branch's Supabase  (SQL Editor -> paste all -> Run).
-- Safe to re-run. Does not touch your existing data.
--
--  • who completed / renamed / deleted each record  (recorded by the DATABASE,
--    from the signed-in login, so it cannot be faked from the website)
--  • cancel reason + note, patient name on pause/cancel events
--  • benefits_audit table = the Activity log (admins of that branch can read it)
-- =====================================================================

-- 1. New columns (all optional, old rows simply stay empty) --------------
alter table public.benefits_completions
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists updated_at timestamptz;

alter table public.benefits_events
  add column if not exists patient_name text,
  add column if not exists reason       text,
  add column if not exists note         text,
  add column if not exists actor_email  text;

-- 2. Activity log table ---------------------------------------------------
create table if not exists public.benefits_audit (
  id           bigserial primary key,
  site_code    text not null,
  action       text not null,            -- complete | rename | delete | pause | cancel | reopen | user_*
  actor_email  text,
  patient_name text,
  program_id   text,
  program_name text,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists benefits_audit_site_time on public.benefits_audit (site_code, created_at desc);

alter table public.benefits_audit enable row level security;
drop policy if exists audit_select on public.benefits_audit;
create policy audit_select on public.benefits_audit
  for select to authenticated
  using (site_code = public.benefits_my_site() and public.benefits_my_role() = 'admin');

revoke all on public.benefits_audit from anon, authenticated;
grant select on public.benefits_audit to authenticated;
grant all on public.benefits_audit to service_role;
grant usage, select on sequence public.benefits_audit_id_seq to service_role;

-- 3. Who is making this change? (the email inside the login token) --------
create or replace function public.benefits_actor()
returns text language sql stable as
$$ select nullif(lower(auth.jwt() ->> 'email'), '') $$;

-- 4. Completions: stamp who/when, and write the log ------------------------
create or replace function public.benefits_completions_stamp()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(public.benefits_actor(), new.created_by);
    new.updated_by := null;
    new.updated_at := null;
  else
    new.created_by := old.created_by;               -- can't be rewritten
    new.updated_by := coalesce(public.benefits_actor(), new.updated_by);
    new.updated_at := now();
  end if;
  return new;
end $$;

create or replace function public.benefits_completions_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.benefits_audit (site_code, action, actor_email, patient_name, program_id, program_name, detail)
    values (new.site_code, 'complete', new.created_by, new.patient_name, new.program_id, new.program_name,
            jsonb_build_object('started_at', new.started_at));
  elsif tg_op = 'UPDATE' then
    if new.patient_name is distinct from old.patient_name then
      insert into public.benefits_audit (site_code, action, actor_email, patient_name, program_id, program_name, detail)
      values (new.site_code, 'rename', new.updated_by, new.patient_name, new.program_id, new.program_name,
              jsonb_build_object('from', old.patient_name, 'to', new.patient_name));
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.benefits_audit (site_code, action, actor_email, patient_name, program_id, program_name, detail)
    values (old.site_code, 'delete', public.benefits_actor(), old.patient_name, old.program_id, old.program_name,
            jsonb_build_object('completed_by', old.created_by, 'finished_at', old.created_at));
  end if;
  return null;
end $$;

drop trigger if exists benefits_completions_stamp_t on public.benefits_completions;
create trigger benefits_completions_stamp_t
  before insert or update on public.benefits_completions
  for each row execute function public.benefits_completions_stamp();

drop trigger if exists benefits_completions_log_t on public.benefits_completions;
create trigger benefits_completions_log_t
  after insert or update or delete on public.benefits_completions
  for each row execute function public.benefits_completions_log();

-- 5. Events (pause / cancel / reopen): stamp who, and write the log --------
create or replace function public.benefits_events_stamp()
returns trigger language plpgsql as $$
begin
  new.actor_email := coalesce(public.benefits_actor(), new.actor_email);
  return new;
end $$;

create or replace function public.benefits_events_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event in ('pause', 'abandon', 'reopen') then
    insert into public.benefits_audit (site_code, action, actor_email, patient_name, program_id, program_name, detail)
    values (new.site_code,
            case new.event when 'abandon' then 'cancel' else new.event end,
            new.actor_email, new.patient_name, new.program_id, new.program_name,
            jsonb_strip_nulls(jsonb_build_object('step_index', new.step_index, 'reason', new.reason, 'note', new.note)));
  end if;
  return null;
end $$;

drop trigger if exists benefits_events_stamp_t on public.benefits_events;
create trigger benefits_events_stamp_t
  before insert on public.benefits_events
  for each row execute function public.benefits_events_stamp();

drop trigger if exists benefits_events_log_t on public.benefits_events;
create trigger benefits_events_log_t
  after insert on public.benefits_events
  for each row execute function public.benefits_events_log();

-- 6. Make sure the server-side role can use everything (needed by the Users function)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Check: should list the new columns
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'benefits_completions' and column_name in ('created_by', 'updated_by', 'updated_at'))
    or (table_name = 'benefits_events' and column_name in ('patient_name', 'reason', 'note', 'actor_email')))
order by 1, 2;
