# Gatehouse

Take-home assignment: a cross-platform app (Android, iOS and web from ONE codebase) with Google login restricted to a single email domain. Example from the brief: only @hbplus.fit emails may log in. Any other domain must see exactly: "Access restricted. Please login using your official domain email."

General Expo rules and commands are in AGENTS.md.

## Required by the assignment

- Google Sign-In button, domain validation, protected Dashboard page, logout, loading state during auth, error handling
- Pages: Login, Dashboard (only accessible after login)
- Security: protected routes (no direct URL access without login, including on web), proper state management, token-handling best practices
- Bonus: role-based access (Admin/User), user data stored in a database, properly protected routes
- Deliverables: GitHub repo with README (setup, auth flow, how domain restriction works) + Netlify deployment

## Stack

Expo SDK 57 + TypeScript, Expo Router (routes in src/app), Supabase Auth with Google (PKCE), NativeWind, Reanimated, expo-linear-gradient, expo-blur, lucide-react-native, Plus Jakarta Sans. Tests: Jest (jest-expo) + React Native Testing Library. Deploy: Netlify (web, single-page output).

## Key decisions

- The allowed domain comes ONLY from EXPO_PUBLIC_ALLOWED_DOMAIN (src/config/env.ts); never hardcode it, including in UI copy. It's set to a college domain for local testing and to hbplus.fit for deployment.
- Domain is enforced in layers: Google's `hd` param (UX hint only), a client-side check that signs the user out immediately, and server-side a Supabase Before User Created hook + row-level security (supabase/migrations; the user runs them by hand, see docs/SUPABASE_SETUP.md). The hook's error carries the marker `DOMAIN_NOT_ALLOWED`, which the client maps to ACCESS_DENIED_MESSAGE; keep the SQL and `src/lib/oauth-callback.ts` in sync.
- Never connect to the user's database; write SQL as idempotent migrations in supabase/migrations.
- Never use or reference the Supabase secret / service_role key in the app. Never log tokens or sessions.
- UI must look premium: dark theme, design tokens in src/constants/theme.ts, reusable primitives in src/components/ui.

## Workflow

- Work in small reviewed steps. After each step: type check, lint and tests must pass, then commit.
- Check current library docs rather than relying on memory; use `npx expo install` for Expo packages.
- Don't run `npm audit fix --force`.

## Progress

- Step 1 done: scaffold, design system, placeholder Login/Dashboard.
- Step 2 done: Supabase client, Google login, domain check, auth context, route guards, tests.
- Step 3 done: server-side enforcement (allowed_domains, Before User Created hook, profiles + triggers, RLS, is_admin, set_user_role), profile/role in the auth context, role-guarded /admin placeholder.
- Step 4 done: real-data dashboard (account, session, access checks, admin card), admin panel (counts, search, role changes with confirm dialog + toasts, skeleton/empty/error states), public /privacy and themed 404, SQL tests in the repo, GitHub Actions CI.
- Before publishing: fill in CONTACT_EMAIL (src/constants/legal.ts); deploy to Netlify.

## Testing notes

- SDK 57's `renderRouter` needs `@testing-library/react-native` v13 (v14 made `render` async), pinned with `react-test-renderer@19.2.3`.
- Tests fake only the Supabase client (`src/test-utils/fake-supabase.ts`, which mirrors RLS and set_user_role); route tests render the real `src/app`. `jest.setup.js` supplies the worklets / Reanimated mocks.
- Jest's `testTimeout` is 30s: with a cold cache (always, in CI) the first full-app render in a suite takes over 5s.
- `npm run test:sql` runs the real migrations on PGlite over `supabase/tests/supabase-stub.sql`. Add a SQL test for every migration change.
- UI must work on web and native, from 360px to 1440px+. Avoid web-only APIs without a native fallback; no `Intl` for dates (use src/utils/format-date.ts).
- After adding a route, run `npx expo start` once to regenerate typed routes (.expo/types), or tsc fails locally.
- Building with different EXPO_PUBLIC_* values needs `npx expo export --clear`: Metro otherwise reuses the old inlined values.
