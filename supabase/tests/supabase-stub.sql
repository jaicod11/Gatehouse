-- Minimal stand-in for what a Supabase project provides before any user migration runs.
-- Roles and default privileges mirror Supabase: new public tables/functions are granted to
-- anon, authenticated and service_role, so the migrations must revoke what they don't want.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_auth_admin nologin noinherit;

-- Supabase: the Auth role has no access to schema public unless granted (per the auth hooks docs).
revoke all on schema public from public;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz default now()
);
grant all on auth.users to supabase_auth_admin;

-- Same definitions Supabase uses: read the PostgREST request claims.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
grant execute on function auth.uid() to anon, authenticated, service_role, supabase_auth_admin;
grant execute on function auth.jwt() to anon, authenticated, service_role, supabase_auth_admin;
