import { isAuthPKCECodeVerifierMissingError } from '@supabase/supabase-js';
import { getLinkingURL } from 'expo-linking';
import { Linking } from 'react-native';

import {
  describeOAuthError,
  describeSignInError,
  isAuthCallbackUrl,
  parseOAuthCallback,
  type OAuthCallbackParams,
} from './oauth-callback';
import { supabase } from './supabase';

/**
 * Finishes Google sign-in from the OAuth callback (`/auth/callback?code=...` or `?error=...`), on
 * iOS and Android, however it arrives:
 *  - the result of WebBrowser.openAuthSessionAsync (the normal case, src/lib/auth.ts),
 *  - a deep link while the app is running (Android also delivers it to Linking),
 *  - the URL the app was started with, or the latest one expo-linking saw, when the OS killed the
 *    app while the browser was open (a cold start: the openAuthSessionAsync promise is gone with
 *    the old process),
 *  - the /auth/callback route.
 * Each code is exchanged exactly once: concurrent callers share one exchange and later ones get
 * its cached outcome. The code verifier comes from storage, so it survives the restart.
 */

export type RedirectOutcome =
  | { type: 'success' }
  /** Nothing was waiting for this code: a stale link, or a sign-in this device already finished. */
  | { type: 'ignored' }
  | { type: 'error'; message: string };

export type RedirectEvent = { phase: 'started' } | { phase: 'finished'; outcome: RedirectOutcome };

const outcomes = new Map<string, Promise<RedirectOutcome>>();
const listeners = new Set<(event: RedirectEvent) => void>();
let inFlight = 0;
// An error that finished before anyone was listening (e.g. before the auth context mounted).
let unreportedError: RedirectOutcome | null = null;

function emit(event: RedirectEvent) {
  if (event.phase === 'finished' && event.outcome.type === 'error' && listeners.size === 0) {
    unreportedError = event.outcome;
  }
  listeners.forEach((listener) => listener(event));
}

async function exchange(callback: OAuthCallbackParams): Promise<RedirectOutcome> {
  if (callback.error) return { type: 'error', message: describeOAuthError(callback) };
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(callback.code!);
    if (!error) return { type: 'success' };
    if (isAuthPKCECodeVerifierMissingError(error)) return { type: 'ignored' };
    return { type: 'error', message: describeSignInError(error) };
  } catch (error) {
    return { type: 'error', message: describeSignInError(error) };
  }
}

/** Completes a callback given as parsed params. Null when they hold neither a code nor an error. */
export function completeOAuthCallback(
  callback: OAuthCallbackParams,
): Promise<RedirectOutcome> | null {
  if (!callback.code && !callback.error) return null;
  const key = callback.code
    ? `code:${callback.code}`
    : `error:${callback.error}:${callback.errorDescription ?? ''}`;

  const existing = outcomes.get(key);
  if (existing) return existing;

  inFlight++;
  emit({ phase: 'started' });
  // Registered before the first await, so a concurrent caller always finds it.
  const outcome = exchange(callback).then((result) => {
    inFlight--;
    emit({ phase: 'finished', outcome: result });
    return result;
  });
  outcomes.set(key, outcome);
  return outcome;
}

/** Completes a callback URL. Null for any other URL. */
export function completeOAuthRedirect(url: string): Promise<RedirectOutcome> | null {
  if (!isAuthCallbackUrl(url)) return null;
  return completeOAuthCallback(parseOAuthCallback(url));
}

/**
 * Follows callbacks finishing in the background. A new listener hears straight away about a
 * callback still in progress, and about an error that finished before anyone listened.
 */
export function subscribeToOAuthRedirects(listener: (event: RedirectEvent) => void): () => void {
  listeners.add(listener);
  if (inFlight > 0) listener({ phase: 'started' });
  if (unreportedError) {
    listener({ phase: 'finished', outcome: unreportedError });
    unreportedError = null;
  }
  return () => {
    listeners.delete(listener);
  };
}

function completeUrl(url: string | null | undefined) {
  if (url) void completeOAuthRedirect(url);
}

/** Completes the URL the app was launched with, and any callback URL that arrives later. */
export function listenForOAuthRedirects(): { remove: () => void } {
  // When Android restores a killed app, the activity is recreated with the intent that first
  // started it (so getInitialURL is the plain app URL) and the callback follows as a new intent,
  // which React Native drops while it is still starting. expo-linking records it natively anyway.
  completeUrl(getLinkingURL());
  Linking.getInitialURL().then(completeUrl, () => undefined);
  return Linking.addEventListener('url', ({ url }) => completeUrl(url));
}

// Start when this module loads, before React mounts, so a callback arriving during startup isn't
// lost while the router is still mounting.
listenForOAuthRedirects();
