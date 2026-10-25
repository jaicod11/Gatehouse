import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { getLinkingURL } from 'expo-linking';
import { Linking } from 'react-native';

import { SIGN_IN_MESSAGES } from '@/lib/oauth-callback';
import {
  completeOAuthCallback,
  completeOAuthRedirect,
  listenForOAuthRedirects,
  subscribeToOAuthRedirects,
  type RedirectEvent,
} from '@/lib/oauth-redirect.native';
import { fakeSupabase, makeSession } from '@/test-utils/fake-supabase';
import { ACCESS_DENIED_MESSAGE } from '@/utils/domain';

// Only the Supabase client is faked; React Native's Linking is the jest preset's mock.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);
// expo-linking's record of the latest deep link (its native side doesn't exist under Jest).
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  getLinkingURL: jest.fn(() => null),
}));

// Exchanges are cached per code for the whole app run (as in the app), so every test uses its own.
let nextCode = 1;
const newCode = () => `code-${nextCode++}`;
const callbackUrl = (code: string) => `exp://192.168.1.5:8081/--/auth/callback?code=${code}`;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Makes exchangeCodeForSession succeed (and sign in), optionally only once `release` is called. */
function exchangeSucceeds({ hold = false } = {}) {
  let release = () => {};
  const gate = hold ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  fakeSupabase.auth.exchangeCodeForSession.mockImplementation(async () => {
    await gate;
    const session = makeSession('grace@example.com');
    fakeSupabase.signIn(session);
    return { data: { session, user: session.user }, error: null };
  });
  return release;
}

beforeEach(() => {
  // Also restores the default exchange: no sign-in waiting (no stored code verifier).
  fakeSupabase.reset();
  // Drain an error left over from an earlier test that nobody listened to.
  subscribeToOAuthRedirects(() => {})();
});

describe('completeOAuthRedirect', () => {
  it('exchanges the code from a callback URL', async () => {
    exchangeSucceeds();
    const code = newCode();

    await expect(completeOAuthRedirect(callbackUrl(code))).resolves.toEqual({ type: 'success' });
    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
  });

  it('exchanges a code exactly once when several paths see it at the same time', async () => {
    const release = exchangeSucceeds({ hold: true });
    const code = newCode();

    // Android can deliver the callback to openAuthSessionAsync, Linking and the route at once.
    const fromBrowser = completeOAuthRedirect(`gatehouse://auth/callback?code=${code}`);
    const fromLinking = completeOAuthRedirect(callbackUrl(code));
    const fromRoute = completeOAuthCallback({
      code,
      error: null,
      errorCode: null,
      errorDescription: null,
    });
    release();

    const outcomes = await Promise.all([fromBrowser, fromLinking, fromRoute]);
    expect(outcomes).toEqual([{ type: 'success' }, { type: 'success' }, { type: 'success' }]);
    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('reuses the outcome when the same callback shows up again later', async () => {
    exchangeSucceeds();
    const code = newCode();
    await completeOAuthRedirect(callbackUrl(code));

    await expect(completeOAuthRedirect(callbackUrl(code))).resolves.toEqual({ type: 'success' });
    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('turns an error in the callback into a friendly message without exchanging anything', async () => {
    const description = encodeURIComponent('DOMAIN_NOT_ALLOWED: sign-ups are limited');
    const url = `gatehouse://auth/callback?error=server_error&error_description=${description}`;

    await expect(completeOAuthRedirect(url)).resolves.toEqual({
      type: 'error',
      message: ACCESS_DENIED_MESSAGE,
    });
    expect(fakeSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('ignores a code that no sign-in on this device is waiting for', async () => {
    await expect(completeOAuthRedirect(callbackUrl(newCode()))).resolves.toEqual({
      type: 'ignored',
    });
  });

  it('reports a network failure during the exchange', async () => {
    fakeSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    });

    await expect(completeOAuthRedirect(callbackUrl(newCode()))).resolves.toEqual({
      type: 'error',
      message: SIGN_IN_MESSAGES.network,
    });
  });

  it.each([
    'exp://192.168.1.5:8081',
    'exp://192.168.1.5:8081/--/dashboard?code=abc',
    'gatehouse://not-auth/callback?code=abc',
    'gatehouse://auth/callback',
  ])('does nothing for %s', (url) => {
    expect(completeOAuthRedirect(url)).toBeNull();
    expect(fakeSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('listenForOAuthRedirects', () => {
  it('finishes a sign-in from the URL the app was launched with (cold start)', async () => {
    exchangeSucceeds();
    const code = newCode();
    jest.mocked(Linking.getInitialURL).mockResolvedValueOnce(callbackUrl(code));

    listenForOAuthRedirects();
    await flush();
    await flush();

    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
    expect(fakeSupabase.emittedEvents()).toContain('SIGNED_IN');
  });

  it('finishes a sign-in that arrived while the app was restarting (Android restoring the task)', async () => {
    exchangeSucceeds();
    const code = newCode();
    // As in the device logs: the restored activity still has the plain app URL, and React Native
    // dropped the callback intent; only expo-linking saw it.
    jest.mocked(getLinkingURL).mockReturnValueOnce(callbackUrl(code));
    jest.mocked(Linking.getInitialURL).mockResolvedValueOnce('exp://192.168.1.5:8081');

    listenForOAuthRedirects();
    await flush();
    await flush();

    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
    expect(fakeSupabase.emittedEvents()).toContain('SIGNED_IN');
  });

  it('exchanges once when expo-linking and the launch URL both have the callback', async () => {
    exchangeSucceeds();
    const code = newCode();
    jest.mocked(getLinkingURL).mockReturnValueOnce(callbackUrl(code));
    jest.mocked(Linking.getInitialURL).mockResolvedValueOnce(callbackUrl(code));

    listenForOAuthRedirects();
    await flush();
    await flush();

    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('finishes a sign-in from a callback URL event', async () => {
    exchangeSucceeds();
    const code = newCode();
    jest.mocked(Linking.getInitialURL).mockResolvedValueOnce(null);

    listenForOAuthRedirects();
    const calls = jest.mocked(Linking.addEventListener).mock.calls;
    const [event, handler] = calls[calls.length - 1];
    expect(event).toBe('url');
    (handler as (event: { url: string }) => void)({ url: callbackUrl(code) });
    await flush();

    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
  });
});

describe('subscribeToOAuthRedirects', () => {
  it('reports when a callback starts and finishes', async () => {
    exchangeSucceeds();
    const events: RedirectEvent[] = [];
    const unsubscribe = subscribeToOAuthRedirects((event) => events.push(event));

    await completeOAuthRedirect(callbackUrl(newCode()));
    unsubscribe();

    expect(events).toEqual([
      { phase: 'started' },
      { phase: 'finished', outcome: { type: 'success' } },
    ]);
  });

  it('tells a late subscriber that a callback is still in progress', async () => {
    const release = exchangeSucceeds({ hold: true });
    const pending = completeOAuthRedirect(callbackUrl(newCode()));
    const events: RedirectEvent[] = [];

    const unsubscribe = subscribeToOAuthRedirects((event) => events.push(event));
    expect(events).toEqual([{ phase: 'started' }]);

    release();
    await pending;
    unsubscribe();
    expect(events[events.length - 1]).toEqual({
      phase: 'finished',
      outcome: { type: 'success' },
    });
  });

  it('delivers an error that finished before anyone listened, once', async () => {
    await completeOAuthRedirect('gatehouse://auth/callback?error=access_denied');
    const first: RedirectEvent[] = [];
    const second: RedirectEvent[] = [];

    subscribeToOAuthRedirects((event) => first.push(event))();
    subscribeToOAuthRedirects((event) => second.push(event))();

    expect(first).toEqual([
      { phase: 'finished', outcome: { type: 'error', message: SIGN_IN_MESSAGES.denied } },
    ]);
    expect(second).toEqual([]);
  });
});
