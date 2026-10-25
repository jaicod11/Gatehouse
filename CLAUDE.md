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
- Never connect to the user's database; write SQL as idempotent migrations in supabase/migrations. Never edit a migration that may already have run; add a new one.
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
- Step 5 done: CONTACT_EMAIL set, disabled buttons look disabled (opacity, no hover, not-allowed cursor), netlify.toml (SPA fallback, security + cache headers), admin bootstrap migration (first allowed sign-up becomes admin while no current admin exists), reviewer README, docs/DEPLOYMENT.md.
- Native fixes done: chunked SecureStore session storage (no custom crypto), expo-crypto shim so PKCE is S256 on Hermes, once-only OAuth callback completion that also covers cold starts (src/lib/oauth-redirect.native.ts), android.package / ios.bundleIdentifier `com.jaideep.gatehouse`, "Running on mobile" in the README. On an Android phone in Expo Go the UI works but sign-in doesn't complete: Expo Go restarts the JS with the bare exp:// URL and loses the callback. A development build is the recommended setup and is untested.
- Next: deploy to Netlify (docs/DEPLOYMENT.md), fill LIVE_URL and OWNER/REPO in the README, test a development build on Android.

## Testing notes

- SDK 57's `renderRouter` needs `@testing-library/react-native` v13 (v14 made `render` async), pinned with `react-test-renderer@19.2.3`.
- Native-only code sits in `.native.ts` files with a `.ts` web counterpart (session-storage, crypto-shim, oauth-redirect). jest-expo runs as iOS, so tests get the `.native` versions.
- Tests fake only the Supabase client (`src/test-utils/fake-supabase.ts`, which mirrors RLS and set_user_role); route tests render the real `src/app`. `jest.setup.js` supplies the worklets / Reanimated mocks.
- Jest's `testTimeout` is 30s: with a cold cache (always, in CI) the first full-app render in a suite takes over 5s.
- `npm run test:sql` runs the real migrations on PGlite over `supabase/tests/supabase-stub.sql`. Add a SQL test for every migration change.
- UI must work on web and native, from 360px to 1440px+. Avoid web-only APIs without a native fallback; no `Intl` for dates (use src/utils/format-date.ts).
- After adding a route, run `npx expo start` once to regenerate typed routes (.expo/types), or tsc fails locally.
- Building with different EXPO_PUBLIC_* values needs `npx expo export --clear`: Metro otherwise reuses the old inlined values.
- Netlify Dev (`netlify dev --dir dist`) applies netlify.toml redirects and headers locally, but its static server always sends `cache-control: max-age=0`; check caching on the live site.
- React Native Web overrides `scrollTo` on ScrollView nodes; in browser scripts set `scrollTop` instead. Pages scroll inside that node, not the window, so full-page screenshot tools repeat content.
