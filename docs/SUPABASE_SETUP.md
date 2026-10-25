# Supabase setup: server-side domain enforcement

This turns on the server half of the domain restriction: a **Before User Created** auth hook that
refuses sign-ups from other domains, a `profiles` table with roles, and row-level security.

Everything here runs in the Supabase dashboard's **SQL Editor**, which runs as the `postgres` role.
You never need the secret / `service_role` key, and the app never uses it.

Before you start, Google sign-in should already work (README → "Supabase setup").

## 1. Run the migrations, in order

For each file in `supabase/migrations/`, open **SQL Editor → New query**, paste the whole file and
click **Run**:

1. `20261025100000_allowed_domains.sql`: `allowed_domains` table and `email_domain_allowed()`
2. `20261025100100_before_user_created_hook.sql`: the hook function and its grants
3. `20261025100200_profiles.sql`: `profiles` table, its triggers on `auth.users`, and a backfill
   for users who already exist
4. `20261025100300_profiles_access.sql`: `is_admin()`, RLS policies, grants, `set_user_role()`

Each should end with "Success. No rows returned". All four are safe to run again. If the editor
warns about destructive operations, that's the `drop policy / drop trigger if exists` lines that
make them re-runnable; confirm.

## 2. Insert your allowed domain

```sql
insert into public.allowed_domains (domain)
values ('vitapstudent.ac.in')          -- 'hbplus.fit' for the deployed version
on conflict (domain) do nothing;

-- Optional: drop the placeholder row (it can't match any real address either way).
delete from public.allowed_domains where domain = 'replace-me.invalid';

select * from public.allowed_domains;
```

Keep it in sync with `EXPO_PUBLIC_ALLOWED_DOMAIN`: the app checks the env value, the database
checks this table, and a user must pass both. Use lowercase, without the `@`. When you deploy
with `hbplus.fit`, put only `hbplus.fit` in that project's table (a different project, or
replace the row).

## 3. Enable the hook

**Authentication → Hooks → Before User Created** (add the hook if it isn't listed), then:

- Hook type: **Postgres**
- Schema: **public**
- Function: **hook_before_user_created**

Save, and make sure the hook shows as enabled.

## 4. Remove accounts from other domains created before the hook

The hook only runs when a user is **created**. Anyone from another domain who signed up while
testing earlier still exists. RLS already hides all data from them, but remove them anyway:

```sql
-- Check the list first.
select id, email, created_at
from auth.users
where not public.email_domain_allowed(email);

-- Then delete them (their profiles go with them).
delete from auth.users
where not public.email_domain_allowed(email);
```

Run this **after** step 2, or it would match every user. A deleted user's current access token
keeps working until it expires (an hour by default), but RLS still gives them nothing.

## 5. Make yourself admin

Sign in to the app once with your own account, so your profile exists (migration 3 also backfills
accounts that already existed). Then:

```sql
update public.profiles
set role = 'admin'
where lower(email) = lower('you@vitapstudent.ac.in');

select email, role, created_at, last_sign_in_at from public.profiles;
```

The app reads your role when it loads your session, so reload the page (or restart the app). The
dashboard then shows an **Admin** badge and button, and `/admin` opens. From then on admins change
roles with `public.set_user_role(target, new_role)`. An admin can't demote themselves, so at least
one admin always remains.

## 6. Manual checks

- [ ] **Allowed account:** sign in. The dashboard shows your name and the right role badge.
      `last_sign_in_at` in `public.profiles` updates on each sign-in.
- [ ] **Account from another domain:** set `EXPO_PUBLIC_GOOGLE_HD_HINT=false` in `.env`, restart
      with `npx expo start -c`, and sign in with a gmail account. The login page shows exactly
      "Access restricted. Please login using your official domain email." Then confirm **no row** was
      created:

  ```sql
  select count(*) from auth.users where email = 'that.account@gmail.com';      -- expect 0
  select count(*) from public.profiles where email = 'that.account@gmail.com'; -- expect 0
  ```

  **Authentication → Users** shouldn't list it, and the Auth logs should show the hook rejecting
  it. Remove `EXPO_PUBLIC_GOOGLE_HD_HINT` afterwards.

- [ ] **Hook, directly in the SQL Editor:**

  ```sql
  select public.hook_before_user_created('{"user": {"email": "someone@gmail.com"}}');
  -- {"error": {"message": "DOMAIN_NOT_ALLOWED: ...", "http_code": 403}}
  select public.hook_before_user_created('{"user": {"email": "someone@vitapstudent.ac.in"}}');
  -- {}
  select public.email_domain_allowed('someone@mail.vitapstudent.ac.in');  -- false
  ```

- [ ] **Nothing is readable with the publishable key alone** (no user session):

  ```bash
  curl "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=*" \
    -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"
  curl "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/allowed_domains?select=*" \
    -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"
  ```

  Both should fail with `permission denied` (code `42501`), not return rows.

- [ ] **Normal user and `/admin`:** with a second allowed account (or after setting your own role
      back to `'user'` in the SQL Editor and reloading), opening `/admin` lands on `/dashboard`, and
      the dashboard shows no Admin button. Restore your admin role afterwards.
- [ ] **Security Advisor** (Database → Advisors): it may list `email_domain_allowed`, `is_admin`
      and `set_user_role` as security-definer functions that `authenticated` can execute. That's
      intended: the RLS policies need the first two, and the third checks for an admin itself. `anon`
      can execute none of them.

## Troubleshooting

- **"Your account isn't set up yet" after signing in:** the account has no profile row. Run the
  backfill `insert ... select ... from auth.users` at the end of migration 3 again, then reload.
- **"Database error saving new user":** the profile trigger failed during sign-up. Check
  **Logs → Postgres** for the reason.
- **Users from another domain can still sign up:** the hook isn't enabled (step 3), or their
  domain is in `allowed_domains`.
