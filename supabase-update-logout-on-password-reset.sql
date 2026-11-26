-- =====================================================================
--  Sign everyone out when a password is changed or reset
--  Run ONCE in each branch's Supabase project: SQL Editor -> New query -> Run.
--  Works for resets from the website's Users tab AND from the Supabase dashboard.
--  Safe to run again.
-- =====================================================================
create or replace function public.revoke_sessions_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deleting the sessions also deletes their refresh tokens (cascade), so no device can stay logged in.
  delete from auth.sessions where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists revoke_sessions_on_password_change on auth.users;
create trigger revoke_sessions_on_password_change
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.revoke_sessions_on_password_change();

-- Optional: sign out EVERY user right now (everyone must log in again). Remove the two dashes to run.
-- delete from auth.sessions;
