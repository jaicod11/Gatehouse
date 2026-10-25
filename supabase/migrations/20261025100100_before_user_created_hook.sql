-- Gatehouse 2/4: the "Before User Created" auth hook. Safe to re-run.
--
-- Supabase Auth calls this before it inserts a new auth.users row, for every sign-up method,
-- Google OAuth included. Returning an error object blocks the sign-up, so an account from another
-- domain never gets a user row, a session or a profile.
--
-- Not active until you enable it: Authentication > Hooks > Before User Created > Postgres >
-- schema public > hook_before_user_created (docs/SUPABASE_SETUP.md).
--
-- It runs as supabase_auth_admin. As Supabase recommends for hooks it isn't security definer;
-- instead that role gets exactly what the hook uses: usage on schema public and execute on this
-- function and on public.email_domain_allowed. It gets no privileges on allowed_domains: the
-- security-definer email_domain_allowed reads that table on its behalf, so execute on that one
-- function is the least access that lets the hook check a domain.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if public.email_domain_allowed(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;

  -- The app looks for the DOMAIN_NOT_ALLOWED marker and shows its own access-denied message; the
  -- rest of this text is never displayed.
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'DOMAIN_NOT_ALLOWED: sign-ups are limited to the organisation''s email domain.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
