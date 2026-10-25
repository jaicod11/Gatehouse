// Web: supabase-js finishes the OAuth redirect itself (detectSessionInUrl exchanges the ?code= on
// /auth/callback), and readWebCallbackError reports errors. Exchanging here as well would use the
// code twice, so these are no-ops. iOS and Android resolve oauth-redirect.native.ts instead.
import type { OAuthCallbackParams } from './oauth-callback';

export type RedirectOutcome =
  { type: 'success' } | { type: 'ignored' } | { type: 'error'; message: string };

export type RedirectEvent = { phase: 'started' } | { phase: 'finished'; outcome: RedirectOutcome };

export function completeOAuthCallback(
  _callback: OAuthCallbackParams,
): Promise<RedirectOutcome> | null {
  return null;
}

export function completeOAuthRedirect(_url: string): Promise<RedirectOutcome> | null {
  return null;
}

export function subscribeToOAuthRedirects(_listener: (event: RedirectEvent) => void): () => void {
  return () => {};
}
