# Gatehouse

One Expo codebase for Android, iOS and web. Sign in with Google is limited to a single email
domain, enforced in the app and in Supabase (an auth hook plus row-level security). The dashboard
is only reachable with an allowed session, and an admin area only with the admin role.

| Route         | Who        | What                                                        |
| ------------- | ---------- | ----------------------------------------------------------- |
| `/login`      | Signed out | Continue with Google                                        |
| `/dashboard`  | Signed in  | Your profile, this session, the access checks you passed    |
| `/admin`      | Admins     | Everyone who has signed in; make people admins or users     |
| `/privacy`    | Anyone     | Privacy policy (needed for the Google OAuth consent screen) |
| anything else | Anyone     | Themed 404 with a way home                                  |

Everything shown is real data from Supabase: there are no placeholder numbers.

**Stack:** Expo SDK 57 · Expo Router (`src/app`) · TypeScript · Supabase Auth (Google, PKCE) ·
NativeWind v4 (Tailwind CSS v3) · Reanimated 4 · expo-blur · expo-linear-gradient ·
lucide-react-native · Plus Jakarta Sans · Jest (jest-expo) + React Native Testing Library

## Getting started

```bash
npm install
cp .env.example .env      # then fill it in; see "Environment" below
npm run web               # or: npm start, then press i / a for a simulator
```

Expo Go on a physical device works with SDK 57.

### Supabase setup

1. **Authentication > Sign In / Providers > Google**: enable it with a Google Cloud OAuth client
   (Web application) whose authorized redirect URI is `https://<project>.supabase.co/auth/v1/callback`.
2. **Authentication > URL Configuration > Redirect URLs**: add every place the app returns to:
   - web dev: `http://localhost:8081/auth/callback`
   - web production: `https://<your-site>/auth/callback`
   - development / production builds: `gatehouse://auth/callback`
   - Expo Go: `exp://<your-LAN-IP>:8081/--/auth/callback` (or a wildcard such as `exp://**`)
3. Run the database migrations and enable the hook: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).
4. **Google Cloud → OAuth consent screen**: set the privacy policy link to
   `https://<your-site>/privacy`, and replace `CONTACT_EMAIL` in `src/constants/legal.ts`.

## Scripts

| Command                | What it does                                |
| ---------------------- | ------------------------------------------- |
| `npm start`            | Expo dev server (scan the QR in Expo Go)    |
| `npm run web`          | Dev server, opens the web build             |
| `npm run ios/android`  | Dev server, opens a simulator / emulator    |
| `npm run lint`         | ESLint (expo config + Prettier)             |
| `npm run lint:fix`     | ESLint with autofix                         |
| `npm run format`       | Prettier, including Tailwind class sorting  |
| `npm run format:check` | Prettier check without writing              |
| `npm run typecheck`    | `tsc --noEmit`                              |
| `npm test`             | Jest: app logic, screens and route guards   |
| `npm run test:watch`   | Jest in watch mode                          |
| `npm run test:sql`     | SQL tests: migrations on in-memory Postgres |

After changing `tailwind.config.js`, `src/constants/theme.ts` or `.env`, restart with
`npx expo start -c` to clear Metro's cache.

## Environment

| Variable                        | Required        | Notes                                            |
| ------------------------------- | --------------- | ------------------------------------------------ |
| `EXPO_PUBLIC_SUPABASE_URL`      | Yes             | `https://<project>.supabase.co`                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes             | Publishable key (`sb_publishable_…`) or anon key |
| `EXPO_PUBLIC_ALLOWED_DOMAIN`    | No (hbplus.fit) | Domain allowed to sign in, without the @         |
| `EXPO_PUBLIC_GOOGLE_HD_HINT`    | No (on)         | `false` drops Google's `hd` hint; testing only   |

Read them through `src/config/env.ts`, never from `process.env` directly. `EXPO_PUBLIC_*` values
are bundled into the app, so they must not contain secrets: never use the Supabase secret /
service_role key. The backend must enforce the domain restriction as well.

## Authentication

**Flow** (`src/lib/auth.ts`, PKCE):

- **Web:** `signInWithOAuth` sends the page to Google, which returns to `/auth/callback?code=…`.
  supabase-js exchanges the code on load (`detectSessionInUrl`); the session lives in
  `localStorage`.
- **iOS / Android:** the app asks Supabase for the Google URL, opens it with
  `WebBrowser.openAuthSessionAsync`, reads `code` from the returned `gatehouse://auth/callback`
  URL and calls `exchangeCodeForSession`. The session is encrypted with AES-256-GCM: the key lives
  in SecureStore, the ciphertext in AsyncStorage (`src/lib/session-storage.native.ts`), because
  sessions can exceed SecureStore's ~2KB comfort zone. Tokens auto-refresh only while the app is in
  the foreground.
- Closing the sign-in sheet is not an error. Network failures and OAuth errors in the callback URL
  show a short message; the provider's raw `error_description` is never displayed. A rejection by
  the domain hook (its error carries `DOMAIN_NOT_ALLOWED`) shows the access-denied message.
- Once a session passes the domain check, the app loads the user's row from `public.profiles`
  (`src/lib/profiles.ts`). The status stays `loading` until it arrives; if it can't be loaded, the
  user is signed out with a message rather than left half signed in.

**Domain restriction**, in layers:

1. Google's `hd` parameter pre-filters the account picker to the allowed domain. It is a UX hint,
   not a security control: anyone can strip it from the sign-in URL or pick "Use another account",
   so nothing relies on it. Enforcement is the client check (2) plus the server-side hook (3).
2. `src/context/auth-context.tsx` checks every session that appears (restored or new) with
   `isAllowedEmail` (`src/utils/domain.ts`): the part after the single `@` must exactly equal the
   allowed domain, so `mail.<domain>`, `x<domain>` and `<domain>.evil.com` are rejected. A failing
   session is signed out immediately, is never exposed as `authenticated`, and the login screen
   shows "Access restricted. Please login using your official domain email."
3. Server side, since anything in the client can be bypassed (`supabase/migrations/`):
   - A **Before User Created** auth hook refuses to create a user whose email isn't on a domain in
     `public.allowed_domains` (same exact-match rule), returning HTTP 403 with `DOMAIN_NOT_ALLOWED`.
     A rejected Google account never gets a row in `auth.users`, a session or a profile.
   - **Row-level security** on `public.profiles`: users read their own row, admins read every row,
     and every policy also requires the email in the caller's JWT to be on an allowed domain, so a
     user from another domain created before the hook existed reads nothing. Clients have no
     insert/update/delete rights; roles change only through `set_user_role`.
   - `allowed_domains` is unreadable by clients, and `anon` can access nothing.

`EXPO_PUBLIC_GOOGLE_HD_HINT=false` exists to demonstrate this. It drops `hd` (keeping
`prompt=select_account`), so Google's account picker offers any account; restart with
`npx expo start -c`, sign in with an account from another domain, and the app still rejects it
with the access-denied message. Leave it unset (on) in production.

**Route protection:** the root layout (`src/app/_layout.tsx`) wraps `(app)` and `(auth)` in
`Stack.Protected` guards and renders a branded loader until the stored session has been checked.
Typing or refreshing `/dashboard` while signed out lands on `/login` (also on web); signed-in
users opening `/login` land on `/dashboard`.

**Roles:** each profile has `role` `'user'` (default) or `'admin'`, exposed as `role` by `useAuth()`.
`(app)/_layout.tsx` guards `/admin` with `Stack.Protected guard={role === 'admin'}`, so a normal
user opening `/admin` lands on `/dashboard`. Admins change roles with the `set_user_role` RPC,
which also checks the caller is an admin and refuses to let an admin demote themselves.

**Database setup:** run the migrations and enable the hook as described in
[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Testing

- **`npm test`** (Jest, jest-expo, React Native Testing Library): unit tests for the domain check,
  OAuth callback handling, date formatting and data access, plus screen tests that render the real
  `src/app` routes with `expo-router/testing-library` (guards, dashboard, admin panel, privacy and
  404 pages). Only the Supabase client is faked (`src/test-utils/fake-supabase.ts`); it applies the
  same rules as the database (RLS, `set_user_role`).
- **`npm run test:sql`** (`supabase/tests/migrations.test.mjs`): applies the real files in
  `supabase/migrations/` twice to [PGlite](https://pglite.dev) (Postgres compiled to WebAssembly),
  on top of `supabase/tests/supabase-stub.sql`, a minimal stand-in for the roles, default grants and
  `auth` schema of a Supabase project. It checks the domain rules, the hook's responses, the
  triggers, every RLS policy and grant, and `set_user_role`. No database or network needed.
- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request: `npm ci`, type check,
  lint, Prettier, Jest and the SQL tests. It needs no secrets.

## Project layout

```
src/
  app/                   routes (Expo Router); no tests or helpers in here
    _layout.tsx          fonts, providers, root Stack with the auth guards
    index.tsx            redirects to /dashboard or /login
    auth/callback.tsx    OAuth return URL: loader, then hands over to index
    (auth)/login.tsx     Google sign-in
    (app)/_layout.tsx    signed-in area; guards /admin by role
    (app)/dashboard.tsx  account, session and access checks; admin card for admins
    (app)/admin.tsx      admin panel: user list, search, role changes
    privacy.tsx          public privacy policy
    +not-found.tsx       themed 404
  components/
    ui/                  design-system primitives (import from '@/components/ui')
    dashboard/, admin/   pieces of those two screens
    page-footer.tsx, google-sign-in-button.tsx, google-logo.tsx, full-screen-loader.tsx, ...
  config/env.ts          typed env access
  constants/             theme.ts (design tokens), legal.ts (CONTACT_EMAIL, policy date)
  context/auth-context.tsx  AuthProvider + useAuth()
  hooks/                 useNow, useProfileList
  lib/                   supabase.ts (client), auth.ts (Google flow), profiles.ts (profile
                         queries and set_user_role), session storage, OAuth callback parsing
  utils/                 domain check, date formatting, profile search/counts
  test-utils/            fake Supabase client and Jest helpers
  **/__tests__/          Jest tests (*.test.ts / *.test.tsx)
supabase/migrations/     SQL: allowed domains, auth hook, profiles, RLS and roles
supabase/tests/          SQL tests (npm run test:sql)
docs/SUPABASE_SETUP.md   running the migrations and enabling the hook
.github/workflows/ci.yml CI
```

## Design system

Tokens live in `src/constants/theme.ts`. `tailwind.config.js` maps them to Tailwind classes, so
the same values work as classes and in plain code:

- Colors: `bg-background`, `bg-surface`, `bg-surface-elevated`, `border-border`,
  `text-fg` / `text-fg-secondary` / `text-fg-muted`, `bg-accent-{indigo,violet,cyan}`,
  `text-success` / `text-warning` / `text-error`
- Type: `font-sans`, `font-medium`, `font-semibold`, `font-bold` all map to Plus Jakarta Sans
  weights. They select a font family rather than setting `fontWeight`, which is disabled.
- Radius: `rounded-control` (16px, buttons), `rounded-card` (24px), plus the `sm` to `3xl` scale

Primitives in `src/components/ui`: `Screen`, `GradientBackground`, `GlassCard`, `Button`,
`Heading` / `Body` / `Caption` / `Text`, `Badge`, `Avatar`, `Alert`, `CardHeader`, `SearchField`,
`ConfirmDialog` (a themed modal, not `window.confirm`), `EmptyState`, `Skeleton` (content
placeholders, instead of spinners) and `Appear` (staggered entrance; skipped when the OS asks for
reduced motion). `ToastProvider` / `useToast()` show short success and error messages. Pass variants such as `tone`,
`size`, `variant` and `weight` as props, and use `className` for layout only. The `cn()` helper
joins class names but doesn't resolve conflicting utilities.
