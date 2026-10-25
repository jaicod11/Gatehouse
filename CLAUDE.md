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
- Domain is enforced in layers: Google's `hd` param (UX hint only), a client-side check that signs the user out immediately, and a server-side Supabase hook + row-level security (added in a later step).
- Never use or reference the Supabase secret / service_role key in the app. Never log tokens or sessions.
- UI must look premium: dark theme, design tokens in src/constants/theme.ts, reusable primitives in src/components/ui.

## Workflow

- Work in small reviewed steps. After each step: type check, lint and tests must pass, then commit.
- Check current library docs rather than relying on memory; use `npx expo install` for Expo packages.
- Don't run `npm audit fix --force`.

## Progress

- Step 1 done: scaffold, design system, placeholder Login/Dashboard.
- Step 2 done: Supabase client, Google login, domain check, auth context, route guards, tests.
- Step 3 (next): server-side enforcement (Supabase auth hook, profiles table, roles, RLS).

## Testing notes

- SDK 57's `renderRouter` needs `@testing-library/react-native` v13 (v14 made `render` async), pinned with `react-test-renderer@19.2.3`.
- Tests fake only the Supabase client (`src/test-utils/fake-supabase.ts`); route tests render the real `src/app`. `jest.setup.js` supplies the worklets / Reanimated mocks.
