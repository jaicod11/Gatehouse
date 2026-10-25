-- Gatehouse 4/4: who can read profiles, and how roles change. Safe to re-run.

-- Whether the signed-in caller has the admin role. security definer, so the policies below can
-- call it without re-entering the policies on profiles (no RLS recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Read access. Every policy also requires the email in the caller's JWT to be on an allowed domain
-- (defense in depth): an existing user from another domain reads nothing, not even their own row.
-- The (select ...) wrappers let Postgres evaluate each check once per query instead of per row.
alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (
    (select public.email_domain_allowed(auth.jwt() ->> 'email'))
    and id = (select auth.uid())
  );

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (
    (select public.email_domain_allowed(auth.jwt() ->> 'email'))
    and (select public.is_admin())
  );

-- No insert, update or delete policies: profiles are written only by the triggers and by
-- set_user_role, so nobody can change their own role. anon gets nothing; authenticated gets only
-- the SELECT the policies above filter.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

-- The only way to change a role. Callable by admins on an allowed domain. An admin can't demote
-- themselves, so there is always at least one admin once the first one exists.
create or replace function public.set_user_role(target uuid, new_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  updated public.profiles;
begin
  if new_role is null or new_role not in ('admin', 'user') then
    raise exception 'Role must be ''admin'' or ''user''.' using errcode = '22023';
  end if;

  -- Lock the caller's and the target's rows in a fixed order before checking anything, so
  -- concurrent calls run one after the other. Otherwise two admins demoting each other at the
  -- same moment could both pass the checks and leave no admin.
  perform 1
  from public.profiles
  where id in (caller, target)
  order by id
  for update;

  if caller is null
    or not public.is_admin()
    or not public.email_domain_allowed(auth.jwt() ->> 'email') then
    raise exception 'Only admins can change roles.' using errcode = '42501';
  end if;

  if target = caller and new_role <> 'admin' then
    raise exception 'Admins can''t remove their own admin role.' using errcode = '42501';
  end if;

  update public.profiles
  set role = new_role
  where id = target
  returning * into updated;

  if not found then
    raise exception 'No profile for that user.' using errcode = 'P0002';
  end if;

  return updated;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Promote the first admin. Run it yourself in the SQL Editor (which bypasses RLS) after that
-- account has signed in once, so its profile exists. Later admins can use set_user_role.
--
--   update public.profiles
--   set role = 'admin'
--   where lower(email) = lower('you@your-domain');
