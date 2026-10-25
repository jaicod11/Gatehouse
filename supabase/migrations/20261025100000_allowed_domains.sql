-- Gatehouse 1/4: allowed email domains, and the domain check that the auth hook and the RLS
-- policies share. Run the migrations in order in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.allowed_domains (
  -- A bare, lowercase domain without "@", like EXPO_PUBLIC_ALLOWED_DOMAIN in the app.
  domain text primary key,
  constraint allowed_domains_domain_format check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$')
);

comment on table public.allowed_domains is
  'Email domains allowed to sign up and use Gatehouse. Exact match only: subdomains are not '
  'allowed. Server-only: RLS is on and there are no client policies.';

-- RLS on with no policies, and the default grants removed: anon and authenticated can neither read
-- nor change this table.
alter table public.allowed_domains enable row level security;
revoke all on table public.allowed_domains from public, anon, authenticated;

-- Placeholder so the table isn't empty by accident. ".invalid" is a reserved TLD (RFC 2606), so no
-- real address can ever match it. Insert your real domain yourself (docs/SUPABASE_SETUP.md):
--   insert into public.allowed_domains (domain) values ('vitapstudent.ac.in');  -- local testing
--   insert into public.allowed_domains (domain) values ('hbplus.fit');          -- deployed version
insert into public.allowed_domains (domain)
values ('replace-me.invalid')
on conflict (domain) do nothing;

-- True only for a single address whose domain exactly matches a row in allowed_domains, ignoring
-- case and surrounding whitespace. Same rules as isAllowedEmail in src/utils/domain.ts: exactly one
-- "@", a non-empty local part, no whitespace inside, no subdomain or suffix matching.
--
-- security definer, so its callers (the auth hook, RLS policies on profiles) need no access to
-- allowed_domains itself. Authenticated users can call it over the API too; all it reveals is
-- whether a domain is allowed, which the app bundle already contains.
create or replace function public.email_domain_allowed(email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        n.address !~ '\s'
        and array_length(string_to_array(n.address, '@'), 1) = 2
        and split_part(n.address, '@', 1) <> ''
        and exists (
          select 1
          from public.allowed_domains d
          where d.domain = split_part(n.address, '@', 2)
        )
      from (select lower(regexp_replace(email, '^\s+|\s+$', '', 'g')) as address) as n
    ),
    false
  );
$$;

revoke execute on function public.email_domain_allowed(text) from public, anon;
grant execute on function public.email_domain_allowed(text) to authenticated, supabase_auth_admin;
