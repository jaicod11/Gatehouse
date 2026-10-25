import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { env } from '@/config/env';
import { signInWithGoogle } from '@/lib/auth';
import { SIGN_IN_MESSAGES } from '@/lib/oauth-callback';
import { fakeSupabase } from '@/test-utils/fake-supabase';
import { ACCESS_DENIED_MESSAGE } from '@/utils/domain';

// The native flow (jest-expo runs as iOS). Faked: the Supabase client, the system browser, and
// makeRedirectUri (it reads the native app manifest, which doesn't exist under Jest).
// signInWithGoogle itself runs for real.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);
jest.mock('expo-web-browser', () => ({
  ...jest.requireActual('expo-web-browser'),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'gatehouse://auth/callback'),
}));

const { WebBrowserResultType } = WebBrowser;
const openAuthSession = jest.mocked(WebBrowser.openAuthSessionAsync);
const GOOGLE_URL = 'https://project.supabase.co/auth/v1/authorize?provider=google';
const REDIRECT_URI = 'gatehouse://auth/callback';

/** The Google query params of the last signInWithOAuth call. */
function sentQueryParams() {
  return fakeSupabase.auth.signInWithOAuth.mock.lastCall?.[0].options.queryParams;
}

beforeEach(() => {
  fakeSupabase.reset();
  openAuthSession.mockReset();
  fakeSupabase.auth.signInWithOAuth.mockResolvedValue({
    data: { provider: 'google', url: GOOGLE_URL },
    error: null,
  });
  fakeSupabase.auth.exchangeCodeForSession.mockResolvedValue({
    data: { session: {}, user: {} },
    error: null,
  });
});

describe('signInWithGoogle (native)', () => {
  it('asks Supabase for a Google URL and opens it in an auth session', async () => {
    openAuthSession.mockResolvedValue({ type: WebBrowserResultType.CANCEL });

    await signInWithGoogle();

    expect(makeRedirectUri).toHaveBeenCalledWith({ scheme: 'gatehouse', path: 'auth/callback' });
    expect(fakeSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: REDIRECT_URI,
        skipBrowserRedirect: true,
        queryParams: expect.any(Object),
      },
    });
    expect(openAuthSession).toHaveBeenCalledWith(GOOGLE_URL, REDIRECT_URI);
  });

  describe('Google hd hint', () => {
    beforeEach(() => {
      openAuthSession.mockResolvedValue({ type: WebBrowserResultType.CANCEL });
    });

    it('is sent for the allowed domain by default', async () => {
      expect(env.googleHdHint).toBe(true);

      await signInWithGoogle();

      expect(sentQueryParams()).toStrictEqual({
        hd: env.allowedDomain,
        prompt: 'select_account',
      });
    });

    it('uses the domain it is given', async () => {
      await signInWithGoogle({ allowedDomain: 'example.com' });

      expect(sentQueryParams()).toStrictEqual({ hd: 'example.com', prompt: 'select_account' });
    });

    it('is left out when turned off, keeping prompt=select_account', async () => {
      await signInWithGoogle({ hdHint: false });

      expect(sentQueryParams()).toStrictEqual({ prompt: 'select_account' });
    });
  });

  it('exchanges the returned code for a session', async () => {
    openAuthSession.mockResolvedValue({
      type: 'success',
      url: 'gatehouse://auth/callback?code=the-code',
    });

    await expect(signInWithGoogle()).resolves.toEqual({ type: 'success' });
    expect(fakeSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('the-code');
  });

  it.each([WebBrowserResultType.CANCEL, WebBrowserResultType.DISMISS])(
    'treats %s as a cancellation, not an error',
    async (type) => {
      openAuthSession.mockResolvedValue({ type });

      await expect(signInWithGoogle()).resolves.toEqual({ type: 'cancelled' });
      expect(fakeSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    },
  );

  it('maps an OAuth error in the callback URL to a friendly message', async () => {
    openAuthSession.mockResolvedValue({
      type: 'success',
      url: 'gatehouse://auth/callback?error=access_denied&error_description=Raw+provider+text',
    });

    await expect(signInWithGoogle()).resolves.toEqual({
      type: 'error',
      message: SIGN_IN_MESSAGES.denied,
    });
    expect(fakeSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('shows the access-denied message when the domain hook rejected the sign-up', async () => {
    const hookMessage = encodeURIComponent(
      "DOMAIN_NOT_ALLOWED: sign-ups are limited to the organisation's email domain.",
    );
    openAuthSession.mockResolvedValue({
      type: 'success',
      url: `gatehouse://auth/callback?error=server_error&error_description=${hookMessage}`,
    });

    await expect(signInWithGoogle()).resolves.toEqual({
      type: 'error',
      message: ACCESS_DENIED_MESSAGE,
    });
    expect(fakeSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('reports a network failure during the code exchange', async () => {
    openAuthSession.mockResolvedValue({
      type: 'success',
      url: 'gatehouse://auth/callback?code=the-code',
    });
    fakeSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    });

    await expect(signInWithGoogle()).resolves.toEqual({
      type: 'error',
      message: SIGN_IN_MESSAGES.network,
    });
  });

  it('reports a thrown network error instead of rejecting', async () => {
    fakeSupabase.auth.signInWithOAuth.mockRejectedValue(new TypeError('Network request failed'));

    await expect(signInWithGoogle()).resolves.toEqual({
      type: 'error',
      message: SIGN_IN_MESSAGES.network,
    });
    expect(openAuthSession).not.toHaveBeenCalled();
  });
});
