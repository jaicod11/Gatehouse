import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { env } from '@/config/env';

import { AUTH_CALLBACK_PATH, SIGN_IN_MESSAGES, describeSignInError } from './oauth-callback';
import { completeOAuthRedirect } from './oauth-redirect';
import { supabase } from './supabase';

/** Must match `expo.scheme` in app.json. */
const APP_SCHEME = 'gatehouse';

export type GoogleSignInResult =
  /** Web: the browser is leaving for Google and comes back to /auth/callback. */
  | { type: 'redirecting' }
  /** Native: a session was created. The auth context still has to check its email domain. */
  | { type: 'success' }
  /** The user closed the sign-in sheet. Not an error. */
  | { type: 'cancelled' }
  | { type: 'error'; message: string };

export type GoogleSignInOptions = {
  /** Defaults to env.allowedDomain. */
  allowedDomain?: string;
  /** Send Google's `hd` account-picker hint. Defaults to env.googleHdHint. */
  hdHint?: boolean;
};

type GoogleQueryParams = Record<string, string>;

let pkceMethodReported = false;

/**
 * Development only: says once which PKCE challenge method supabase-js chose ("s256" expected; it
 * falls back to "plain" without WebCrypto). Reads only the method, never the challenge.
 */
function reportPkceMethod(authorizeUrl: string) {
  if (!__DEV__ || pkceMethodReported || process.env.NODE_ENV === 'test') return;
  pkceMethodReported = true;
  const query = authorizeUrl.split('#')[0].split('?')[1] ?? '';
  const method = new URLSearchParams(query).get('code_challenge_method') ?? 'missing';
  if (method === 's256') console.log(`[auth] PKCE code_challenge_method=${method}`);
  else console.warn(`[auth] PKCE code_challenge_method=${method} (expected s256)`);
}

/**
 * Google OAuth parameters. `hd` only tells Google's account picker which Workspace domain to show.
 * It is a UX hint, NOT security: anyone can strip it from the URL or pick another account, which is
 * what turning it off (EXPO_PUBLIC_GOOGLE_HD_HINT=false) demonstrates. Access is enforced by
 * isAllowedEmail in the auth context, and must be enforced by Supabase as well.
 */
function googleQueryParams(allowedDomain: string, hdHint: boolean): GoogleQueryParams {
  return hdHint ? { hd: allowedDomain, prompt: 'select_account' } : { prompt: 'select_account' };
}

/**
 * Starts Google sign-in through Supabase (PKCE). Never throws: failures come back as a friendly
 * message. The resulting session reaches the app through supabase.auth.onAuthStateChange.
 */
export async function signInWithGoogle({
  allowedDomain = env.allowedDomain,
  hdHint = env.googleHdHint,
}: GoogleSignInOptions = {}): Promise<GoogleSignInResult> {
  const queryParams = googleQueryParams(allowedDomain, hdHint);
  try {
    return Platform.OS === 'web'
      ? await signInOnWeb(queryParams)
      : await signInOnNative(queryParams);
  } catch (error) {
    return { type: 'error', message: describeSignInError(error) };
  }
}

async function signInOnWeb(queryParams: GoogleQueryParams): Promise<GoogleSignInResult> {
  // supabase-js navigates the page to Google. On return, it exchanges the ?code= on /auth/callback
  // (detectSessionInUrl).
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/${AUTH_CALLBACK_PATH}`,
      queryParams,
    },
  });
  if (error) return { type: 'error', message: describeSignInError(error) };
  return { type: 'redirecting' };
}

async function signInOnNative(queryParams: GoogleQueryParams): Promise<GoogleSignInResult> {
  // gatehouse://auth/callback in a development or production build, exp://.../--/auth/callback in
  // Expo Go. Whichever it is must be listed under Supabase Auth > URL Configuration > Redirect URLs.
  const redirectTo = makeRedirectUri({ scheme: APP_SCHEME, path: AUTH_CALLBACK_PATH });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams,
    },
  });
  if (error) return { type: 'error', message: describeSignInError(error) };
  if (!data.url) return { type: 'error', message: SIGN_IN_MESSAGES.failed };
  reportPkceMethod(data.url);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { type: 'cancelled' };

  // The same once-only completion that handles a callback arriving through Linking or the
  // /auth/callback route (Android can deliver the same URL to all of them).
  const outcome = await completeOAuthRedirect(result.url);
  if (outcome?.type === 'success') return { type: 'success' };
  if (outcome?.type === 'error') return { type: 'error', message: outcome.message };
  // Not a callback URL, or no stored code verifier for this sign-in.
  return { type: 'error', message: SIGN_IN_MESSAGES.failed };
}
