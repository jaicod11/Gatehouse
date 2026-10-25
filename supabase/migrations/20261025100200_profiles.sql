-- Gatehouse 3/4: profiles, created and kept in sync by triggers on auth.users. Safe to re-run.
-- Access rules (RLS, grants, roles) are in the next migration.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz default now(),
  last_sign_in_at timestamptz,
  constraint profiles_role_check check (role in ('admin', 'user'))
);

comment on table public.profiles is
  'One row per auth user, created by a trigger. Users read their own row, admins read all rows. '
  'Roles change only through public.set_user_role.';

-- Lock the table down right away; the next migration grants back exactly what the policies need.
alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;

-- Creates the profile when Supabase Auth inserts a user. Google fills full_name/name and
-- avatar_url/picture in raw_user_meta_data. If this trigger fails, the sign-up fails with it.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, last_sign_in_at)
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
    new.last_sign_in_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_on_signup on auth.users;
create trigger create_profile_on_signup
  after insert on auth.users
  for each row
  execute function public.create_profile_for_new_user();

-- Copies auth.users.last_sign_in_at to the profile on every sign-in.
create or replace function public.sync_profile_last_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_last_sign_in on auth.users;
create trigger sync_profile_last_sign_in
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.sync_profile_last_sign_in();

-- Trigger functions are never called directly.
revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_last_sign_in() from public, anon, authenticated;

-- Backfill users who signed up before this migration (for example while testing the app before
-- the hook existed). Users from other domains get a row too, but RLS hides it from them; delete
-- such users as described in docs/SUPABASE_SETUP.md.
insert into public.profiles (id, email, full_name, avatar_url, last_sign_in_at)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', '')
  ),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(u.raw_user_meta_data ->> 'picture', '')
  ),
  u.last_sign_in_at
from auth.users as u
where u.email is not null
on conflict (id) do nothing;
