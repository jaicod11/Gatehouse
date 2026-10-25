-- Gatehouse 5 (after 1-4): admin bootstrap. Safe to re-run.
--
-- Replaces the profile trigger function from migration 3: a new profile is created as 'admin' when
-- there is no current admin, otherwise as 'user' (as before). A "current admin" is a profile with
-- role 'admin' whose email is on a domain that is in allowed_domains right now.
--
-- A deliberate bootstrap pattern:
--   * On a fresh project, the first person from the allowed domain to sign in becomes the admin,
--     so nobody has to run SQL by hand to get one.
--   * After allowed_domains is switched to another domain, admins from the old domain stop counting
--     (they already can't read or change anything: RLS and set_user_role check the JWT email
--     domain), so the first person from the new domain becomes admin.
--   * Only users on an allowed domain can be bootstrapped. With the Before User Created hook
--     enabled, nobody else gets a profile at all.
--   * Profiles that already exist are never promoted by this; only new ones.
--
-- Security trade-off: whoever signs in first while there is no current admin gets admin rights.
-- Sign in yourself right after the first deploy and after every domain switch, then confirm with
--   select email, role from public.profiles where role = 'admin';
-- If someone else got there first, fix it in the SQL Editor (docs/SUPABASE_SETUP.md).
--
-- Race safety: two first sign-ins at the same moment would both see "no admin yet". So while no
-- current admin exists, the trigger takes a transaction-scoped advisory lock and checks again.
-- Concurrent first sign-ups run that check one after the other (the lock is held until the
-- sign-up transaction commits), and only the first becomes admin. Once an admin exists the lock is
-- skipped, so ordinary sign-ups never wait on each other.

-- Whether any profile with role 'admin' has an email on a currently allowed domain.
create or replace function public.current_admin_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.role = 'admin' and public.email_domain_allowed(p.email)
  );
$$;

-- Only the trigger below uses it.
revoke execute on function public.current_admin_exists() from public, anon, authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role text := 'user';
begin
  if public.email_domain_allowed(new.email) and not public.current_admin_exists() then
    perform pg_advisory_xact_lock(hashtext('gatehouse.admin_bootstrap'));
    -- Check again under the lock: a concurrent first sign-up may have just committed as admin.
    -- Each statement here takes a fresh snapshot, so that commit is visible.
    if not public.current_admin_exists() then
      new_role := 'admin';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, last_sign_in_at, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', '')
    ),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', '')
    ),
    new.last_sign_in_at,
    new_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger functions are never called directly.
revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;
