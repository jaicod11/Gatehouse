import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/** Route that Supabase redirects to after Google sign-in, on web and native. */
export const AUTH_CALLBACK_PATH = 'auth/callback';

export const SIGN_IN_MESSAGES = {
  network: "Couldn't reach the sign-in service. Check your connection and try again.",
  denied: 'Google sign-in was cancelled or access was denied.',
  failed: 'Sign-in failed. Please try again.',
} as const;

export type OAuthCallbackParams = {
  /** PKCE authorization code to exchange for a session. */
  code: string | null;
  /** OAuth error code (`access_denied`, ...), or "unknown" when only a description was sent. */
  error: string | null;
};

/**
 * Reads the code or error from a callback URL. Supabase sends them as query parameters, but some
 * errors arrive in the fragment, so both are checked. Works for https://, gatehouse:// and exp://.
 */
export function parseOAuthCallback(url: string): OAuthCallbackParams {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const query = new URLSearchParams(queryAt === -1 ? '' : beforeHash.slice(queryAt + 1));
  const fragment = new URLSearchParams(hashAt === -1 ? '' : url.slice(hashAt + 1));
  const read = (name: string) => query.get(name) || fragment.get(name) || null;

  const error =
    read('error') ?? read('error_code') ?? (read('error_description') ? 'unknown' : null);
  return { code: read('code'), error };
}

/**
 * Short, friendly text for an OAuth error code. The provider's error_description is never shown:
 * it's technical, and anyone can put arbitrary text in a crafted callback link.
 */
export function describeOAuthError(error: string): string {
  return error === 'access_denied' ? SIGN_IN_MESSAGES.denied : SIGN_IN_MESSAGES.failed;
}

/** Short, friendly text for an error thrown or returned while signing in. */
export function describeSignInError(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return SIGN_IN_MESSAGES.network;
  if (error instanceof TypeError && /network|fetch|load failed/i.test(error.message)) {
    return SIGN_IN_MESSAGES.network;
  }
  return SIGN_IN_MESSAGES.failed;
}

/**
 * Web only: the message for an OAuth error that Supabase redirected back to /auth/callback with.
 * (A successful ?code= is exchanged by supabase-js itself; see detectSessionInUrl.)
 */
export function readWebCallbackError(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!window.location.pathname.endsWith(`/${AUTH_CALLBACK_PATH}`)) return null;
  const { error } = parseOAuthCallback(window.location.href);
  return error ? describeOAuthError(error) : null;
}
