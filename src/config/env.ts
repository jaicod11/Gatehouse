/**
 * Typed access to the EXPO_PUBLIC_* variables from .env (see .env.example).
 *
 * Expo inlines these at build time, and only for literal `process.env.EXPO_PUBLIC_*` reads, so each
 * one is referenced explicitly below. Restart with `npx expo start -c` after editing .env.
 * Everything here ships in the client bundle: never put secrets in these variables.
 */

const DEFAULT_ALLOWED_DOMAIN = 'hbplus.fit';

export class EnvError extends Error {
  override name = 'EnvError';
}

function read(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const raw = {
  EXPO_PUBLIC_SUPABASE_URL: read(process.env.EXPO_PUBLIC_SUPABASE_URL),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: read(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  EXPO_PUBLIC_ALLOWED_DOMAIN: read(process.env.EXPO_PUBLIC_ALLOWED_DOMAIN),
};

type RequiredVar = 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

function required(name: RequiredVar): string {
  const value = raw[name];
  if (!value) {
    throw new EnvError(
      `${name} is not set. Copy .env.example to .env, fill it in, then restart with "npx expo start -c".`,
    );
  }
  return value;
}

function parseAllowedDomain(value: string | undefined): string {
  if (value === undefined) return DEFAULT_ALLOWED_DOMAIN;
  const domain = value.toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    throw new EnvError(
      `EXPO_PUBLIC_ALLOWED_DOMAIN must be a bare domain like "${DEFAULT_ALLOWED_DOMAIN}", got "${value}".`,
    );
  }
  return domain;
}

function parseSupabaseUrl(value: string): string {
  if (!/^https?:\/\/[^\s/]+/.test(value)) {
    throw new EnvError(
      `EXPO_PUBLIC_SUPABASE_URL must be a URL like "https://<project>.supabase.co", got "${value}".`,
    );
  }
  return value.replace(/\/+$/, '');
}

export const env = {
  /**
   * Google accounts must belong to this domain: lowercase, without the "@". Defaults to
   * hbplus.fit. The client check is for UX only; the backend has to enforce it too.
   */
  allowedDomain: parseAllowedDomain(raw.EXPO_PUBLIC_ALLOWED_DOMAIN),

  /** Throws an EnvError when unset, so only read it where Supabase is actually used. */
  get supabaseUrl(): string {
    return parseSupabaseUrl(required('EXPO_PUBLIC_SUPABASE_URL'));
  },

  /** Throws an EnvError when unset, so only read it where Supabase is actually used. */
  get supabaseAnonKey(): string {
    return required('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  },
};

/** Required variables that are currently unset. */
export const missingEnvVars: RequiredVar[] = (
  ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const
).filter((name) => !raw[name]);

if (__DEV__ && missingEnvVars.length > 0) {
  console.warn(
    `[env] Missing ${missingEnvVars.join(', ')}. Sign-in can't work without them: add them to .env ` +
      '(see .env.example) and restart with "npx expo start -c".',
  );
}
