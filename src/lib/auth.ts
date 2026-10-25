import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import {
  AUTH_CALLBACK_PATH,
  SIGN_IN_MESSAGES,
  describeOAuthError,
  describeSignInError,
  parseOAuthCallback,
} from './oauth-callback';
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

/**
 * Google OAuth parameters. `hd` only tells Google's account picker which Workspace domain to show.
 * It is a UX hint, NOT security: anyone can strip it from the URL or pick another account. Access
 * is enforced by isAllowedEmail in the auth context, and must be enforced by Supabase as well.
 */
function googleQueryParams(allowedDomain: string) {
  return { hd: allowedDomain, prompt: 'select_account' };
}

/**
 * Starts Google sign-in through Supabase (PKCE). Never throws: failures come back as a friendly
 * message. The resulting session reaches the app through supabase.auth.onAuthStateChange.
 */
export async function signInWithGoogle(allowedDomain: string): Promise<GoogleSignInResult> {
  try {
    return Platform.OS === 'web'
      ? await signInOnWeb(allowedDomain)
      : await signInOnNative(allowedDomain);
  } catch (error) {
    return { type: 'error', message: describeSignInError(error) };
  }
}

async function signInOnWeb(allowedDomain: string): Promise<GoogleSignInResult> {
  // supabase-js navigates the page to Google. On return, it exchanges the ?code= on /auth/callback
  // (detectSessionInUrl).
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/${AUTH_CALLBACK_PATH}`,
      queryParams: googleQueryParams(allowedDomain),
    },
  });
  if (error) return { type: 'error', message: describeSignInError(error) };
  return { type: 'redirecting' };
}

async function signInOnNative(allowedDomain: string): Promise<GoogleSignInResult> {
  // gatehouse://auth/callback in a development or production build, exp://.../--/auth/callback in
  // Expo Go. Whichever it is must be listed under Supabase Auth > URL Configuration > Redirect URLs.
  const redirectTo = makeRedirectUri({ scheme: APP_SCHEME, path: AUTH_CALLBACK_PATH });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: googleQueryParams(allowedDomain),
    },
  });
  if (error) return { type: 'error', message: describeSignInError(error) };
  if (!data.url) return { type: 'error', message: SIGN_IN_MESSAGES.failed };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { type: 'cancelled' };

  const { code, error: oauthError } = parseOAuthCallback(result.url);
  if (oauthError) return { type: 'error', message: describeOAuthError(oauthError) };
  if (!code) return { type: 'error', message: SIGN_IN_MESSAGES.failed };

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return { type: 'error', message: describeSignInError(exchangeError) };
  return { type: 'success' };
}
