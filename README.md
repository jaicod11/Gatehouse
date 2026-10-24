# Gatehouse

One Expo codebase for Android, iOS and web. Google sign-in, limited to a single email domain, is
coming in a later step. This step covers the project setup and the UI foundation only.

**Stack:** Expo SDK 57 · Expo Router (`src/app`) · TypeScript · NativeWind v4 (Tailwind CSS v3) ·
Reanimated 4 · expo-blur · expo-linear-gradient · lucide-react-native · Plus Jakarta Sans

## Getting started

```bash
npm install
cp .env.example .env      # optional for now; see "Environment" below
npm run web               # or: npm start, then press i / a for a simulator
```

Expo Go on a physical device works with SDK 57.

## Scripts

| Command                | What it does                               |
| ---------------------- | ------------------------------------------ |
| `npm start`            | Expo dev server (scan the QR in Expo Go)   |
| `npm run web`          | Dev server, opens the web build            |
| `npm run ios/android`  | Dev server, opens a simulator / emulator   |
| `npm run lint`         | ESLint (expo config + Prettier)            |
| `npm run lint:fix`     | ESLint with autofix                        |
| `npm run format`       | Prettier, including Tailwind class sorting |
| `npm run format:check` | Prettier check without writing             |
| `npm run typecheck`    | `tsc --noEmit`                             |

After changing `tailwind.config.js`, `src/constants/theme.ts` or `.env`, restart with
`npx expo start -c` to clear Metro's cache.

## Environment

| Variable                        | Required        | Notes                                    |
| ------------------------------- | --------------- | ---------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Later           | Unused yet; warns in dev while missing   |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Later           | Unused yet; warns in dev while missing   |
| `EXPO_PUBLIC_ALLOWED_DOMAIN`    | No (hbplus.fit) | Domain allowed to sign in, without the @ |

Read them through `src/config/env.ts`, never from `process.env` directly. `EXPO_PUBLIC_*` values
are bundled into the app, so they must not contain secrets, and the backend must enforce the
domain restriction as well.

## Project layout

```
src/
  app/                 routes (Expo Router)
    _layout.tsx        fonts, global.css, providers, root Stack
    index.tsx          redirects to /login for now
    (auth)/login.tsx   placeholder sign-in screen
    (app)/dashboard.tsx  placeholder dashboard + component preview
  components/
    ui/                design-system primitives (import from '@/components/ui')
    logo-mark.tsx
  config/env.ts        typed env access
  constants/theme.ts   design tokens (single source of truth)
  context/  hooks/  lib/  utils/
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
`Heading` / `Body` / `Caption` / `Text`, `Badge` and `Avatar`. Pass variants such as `tone`,
`size`, `variant` and `weight` as props, and use `className` for layout only. The `cn()` helper
joins class names but doesn't resolve conflicting utilities.
