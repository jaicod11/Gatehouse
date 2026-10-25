import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { ACCESS_DENIED_MESSAGE } from '@/utils/domain';

/** Route that Supabase redirects to after Google sign-in, on web and native. */
export const AUTH_CALLBACK_PATH = 'auth/callback';

/**
 * Marker in the error that the Before User Created hook returns for a disallowed domain
 * (supabase/migrations/*_before_user_created_hook.sql). Keep the two in sync.
 */
export const DOMAIN_NOT_ALLOWED_MARKER = 'DOMAIN_NOT_ALLOWED';

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
  /** Supabase's error_code and error_description. Only read to recognise errors; never shown. */
  errorCode: string | null;
  errorDescription: string | null;
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
  return toCallbackParams((name) => query.get(name) || fragment.get(name) || null);
}

/** The same, from a route's search params (e.g. expo-router's useLocalSearchParams). */
export function callbackFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): OAuthCallbackParams {
  return toCallbackParams((name) => {
    const value = params[name];
    return (Array.isArray(value) ? value[0] : value) || null;
  });
}

function toCallbackParams(read: (name: string) => string | null): OAuthCallbackParams {
  const errorCode = read('error_code');
  const errorDescription = read('error_description');
  const error = read('error') ?? errorCode ?? (errorDescription ? 'unknown' : null);
  return { code: read('code'), error, errorCode, errorDescription };
}

/**
 * Whether a URL points at the OAuth callback route, whatever the scheme: gatehouse://auth/callback,
 * exp://<host>/--/auth/callback or https://<site>/auth/callback.
 */
export function isAuthCallbackUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return new RegExp(`(^|[/:])${AUTH_CALLBACK_PATH.replace('/', '\\/')}$`).test(path);
}

/**
 * Short, friendly text for an OAuth error from a callback URL. A rejection by the domain hook shows
 * the required access-denied message. The provider's error_description itself is never shown:
 * it's technical, and anyone can put arbitrary text in a crafted callback link.
 */
export function describeOAuthError({
  error,
  errorCode,
  errorDescription,
}: Pick<OAuthCallbackParams, 'error' | 'errorCode' | 'errorDescription'>): string {
  // Supabase passes the hook's message through, but which parameter carries it isn't documented
  // for OAuth redirects, so look in all three.
  if (
    [error, errorCode, errorDescription].some((value) => value?.includes(DOMAIN_NOT_ALLOWED_MARKER))
  ) {
    return ACCESS_DENIED_MESSAGE;
  }
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
  const callback = parseOAuthCallback(window.location.href);
  return callback.error ? describeOAuthError(callback) : null;
}
