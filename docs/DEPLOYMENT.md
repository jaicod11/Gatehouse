# Deploying Gatehouse to Netlify

The web app is a static single-page build. Netlify builds it from GitHub using
[`netlify.toml`](../netlify.toml): build command, `dist` folder, Node 24, SPA fallback and security
headers. Before you start, finish [SUPABASE_SETUP.md](SUPABASE_SETUP.md) (migrations, allowed
domain, hook).

Below, `<site>` is your Netlify site name and `<project>` your Supabase project ref.

## 1. Push to GitHub

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then check that the README's CI badge points to the repository (`jaicod11/Gatehouse`) and that
the **CI** workflow passes in the repository's Actions tab.

## 2. Create the Netlify site

1. Netlify → **Add new project → Import an existing project → GitHub**, and pick the repository.
2. Leave the build settings as Netlify reads them from `netlify.toml`: command
   `npx expo export -p web`, publish directory `dist`.
3. Before the first deploy, add the environment variables (**Project configuration → Environment
   variables**):

   | Key                             | Value                                         |
   | ------------------------------- | --------------------------------------------- |
   | `EXPO_PUBLIC_SUPABASE_URL`      | `https://<project>.supabase.co`               |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the publishable key (`sb_publishable_...`)    |
   | `EXPO_PUBLIC_ALLOWED_DOMAIN`    | `hbplus.fit` (to change it later, see step 6) |
   | `EXPO_PUBLIC_GOOGLE_HD_HINT`    | `false`                                       |

   `EXPO_PUBLIC_GOOGLE_HD_HINT=false` turns off Google's `hd` hint so reviewers can pick an account
   from another domain and see the rejection; with the hint on, Google may lock the account picker
   to the allowed domain. Never add the secret / `service_role` key.
   These values are baked into the bundle at build time, so changing one needs a new deploy.

4. Deploy. To get a nicer URL, rename the project (**Project configuration → Change project
   name**) to get `https://<site>.netlify.app`.

## 3. Supabase URL configuration

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://<site>.netlify.app`
- **Redirect URLs:** add `https://<site>.netlify.app/**`. Keep the local ones:
  `http://localhost:8081/**`, `gatehouse://auth/callback` and `exp://**`.

## 4. Google Auth Platform

Google Cloud console → **Google Auth Platform**, for the project that owns your OAuth client:

1. **Branding**
   - App name, support email and developer contact.
   - **Application home page:** `https://<site>.netlify.app`
   - **Application privacy policy link:** `https://<site>.netlify.app/privacy`
   - **Authorized domains:** add `<site>.netlify.app`, and keep `<project>.supabase.co`.
2. **Clients:** the web client's authorized redirect URI stays
   `https://<project>.supabase.co/auth/v1/callback`. Supabase handles the callback, so nothing on
   Netlify goes here.
3. **Audience → Publish app.** While the app is in _Testing_, only listed test users can sign in.
   Gatehouse asks only for the basic scopes (openid, email, profile), which Google doesn't review.

The privacy page shows `CONTACT_EMAIL` from `src/constants/legal.ts`; make sure it's an address
you read.

## 5. Check the deploy

- [ ] `https://<site>.netlify.app` shows the login page with "@hbplus.fit accounts only".
- [ ] Sign in with your account. You land on the dashboard. If this is the first sign-up, you're
      admin (check with `select email, role from public.profiles;`).
- [ ] Reload `/dashboard` and open `/admin` directly: both stay put. Open `/privacy` in a private
      window: it shows without signing in. `/nope` shows the 404 page.
- [ ] A Gmail account gets "Access restricted. Please login using your official domain email."
      and no row in `auth.users`.
- [ ] Headers:

  ```bash
  curl -sI https://<site>.netlify.app/dashboard
  # 200, x-frame-options: DENY, x-content-type-options: nosniff,
  # referrer-policy: strict-origin-when-cross-origin, permissions-policy: camera=(), ...
  # cache-control without a long max-age

  curl -sI https://<site>.netlify.app/_expo/static/js/web/<entry-file>.js
  # cache-control: public, max-age=31536000, immutable
  ```

  Find `<entry-file>` in the page source. Check caching on the live site, not locally: Netlify
  Dev's local server always sends `max-age=0`.

## 6. Switch the allowed domain

Gatehouse was developed and tested on `vitapstudent.ac.in`, and the live site was then moved to
`hbplus.fit` with these steps. To switch domains, do these together (shown for that move):

1. **Netlify:** set `EXPO_PUBLIC_ALLOWED_DOMAIN` to `hbplus.fit`, then **Deploys → Trigger deploy →
   Clear cache and deploy project**.
2. **Supabase SQL Editor:**

   ```sql
   begin;
   insert into public.allowed_domains (domain) values ('hbplus.fit') on conflict (domain) do nothing;
   delete from public.allowed_domains where domain = 'vitapstudent.ac.in';
   commit;

   select * from public.allowed_domains;
   ```

   Between the two steps the app and the database disagree, so sign-ins fail safely with the
   access-denied message. Nobody gets in who shouldn't.

3. **Admin:** old-domain admins stop counting, so the **first hbplus.fit user to sign up becomes
   admin** (the [admin bootstrap](../README.md#roles-and-data-security)). Have the intended admin sign
   in first, then check:

   ```sql
   select email, role, created_at from public.profiles where role = 'admin';
   ```

4. **Old accounts (optional):** vitapstudent.ac.in accounts can no longer sign in or read anything.
   Remove them, after step 2:

   ```sql
   select email from auth.users where not public.email_domain_allowed(email);
   delete from auth.users where not public.email_domain_allowed(email);
   ```

5. Update the live-demo note at the top of the README.

### After the switch

- [ ] The login page and the privacy page say hbplus.fit (if not, the deploy didn't clear the cache).
- [ ] Google's account picker shows every account, because `EXPO_PUBLIC_GOOGLE_HD_HINT` is `false`
      (with the hint on, it would suggest hbplus.fit accounts).
- [ ] An hbplus.fit account signs in, and the intended person is the admin.
- [ ] A vitapstudent.ac.in account gets the access-denied message. After step 4, retrying creates no
      row in `auth.users`.
- [ ] `/admin` works for the admin, and a normal hbplus.fit user opening it lands on `/dashboard`.
