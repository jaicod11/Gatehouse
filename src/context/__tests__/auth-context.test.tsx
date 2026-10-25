import { act, render, waitFor } from '@testing-library/react-native';

import { env } from '@/config/env';
import { AuthProvider, useAuth, type AuthContextValue } from '@/context/auth-context';
import { PROFILE_MESSAGES } from '@/lib/profiles';
import { fakeSupabase, makeSession } from '@/test-utils/fake-supabase';
import { ACCESS_DENIED_MESSAGE } from '@/utils/domain';

// Only the Supabase client is faked. The context, the domain check and env run for real.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);

const allowedEmail = `ada.lovelace@${env.allowedDomain}`;

/** Renders the provider and records the context value of every render. */
function renderAuth() {
  const renders: AuthContextValue[] = [];
  function Probe() {
    renders.push(useAuth());
    return null;
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  return {
    current: () => renders[renders.length - 1],
    statuses: () => renders.map((value) => value.status),
  };
}

beforeEach(() => {
  fakeSupabase.reset();
});

describe('AuthProvider', () => {
  it('starts loading, then authenticates a restored session on the allowed domain', async () => {
    fakeSupabase.setStoredSession(
      makeSession(allowedEmail, {
        full_name: 'Ada Lovelace',
        avatar_url: 'https://example.com/ada.png',
      }),
    );
    const auth = renderAuth();

    expect(auth.statuses()[0]).toBe('loading');
    await waitFor(() => expect(auth.current().status).toBe('authenticated'));

    expect(auth.current().user).toEqual({
      id: expect.any(String),
      email: allowedEmail,
      fullName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
    });
    expect(auth.current().session?.user.email).toBe(allowedEmail);
    expect(auth.current().error).toBeNull();
    expect(fakeSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('settles as unauthenticated without a stored session', async () => {
    const auth = renderAuth();

    await waitFor(() => expect(auth.current().status).toBe('unauthenticated'));
    expect(auth.current().user).toBeNull();
    expect(auth.current().error).toBeNull();
  });

  it('signs out a restored session from another domain without ever authenticating it', async () => {
    fakeSupabase.setStoredSession(makeSession('mallory@gmail.com'));
    const auth = renderAuth();

    await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'));

    expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.current().status).toBe('unauthenticated');
    expect(auth.current().error).toBe(ACCESS_DENIED_MESSAGE);
    expect(auth.current().session).toBeNull();
    expect(auth.current().user).toBeNull();
    expect(auth.statuses()).not.toContain('authenticated');
  });

  it('rejects a new sign-in from a lookalike domain and keeps the message after SIGNED_OUT', async () => {
    const auth = renderAuth();
    await waitFor(() => expect(auth.current().status).toBe('unauthenticated'));

    act(() => {
      fakeSupabase.signIn(makeSession(`mallory@mail.${env.allowedDomain}`));
    });

    // The access-denied message must survive the SIGNED_OUT that the rejection triggers.
    await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'));
    expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.current().error).toBe(ACCESS_DENIED_MESSAGE);
    expect(auth.current().status).toBe('unauthenticated');
    expect(auth.current().user).toBeNull();
    expect(auth.statuses()).not.toContain('authenticated');
  });

  it('authenticates a new sign-in on the allowed domain', async () => {
    const auth = renderAuth();
    await waitFor(() => expect(auth.current().status).toBe('unauthenticated'));

    act(() => {
      fakeSupabase.signIn(makeSession(allowedEmail));
    });

    await waitFor(() => expect(auth.current().status).toBe('authenticated'));
    expect(auth.current().user?.email).toBe(allowedEmail);
  });

  it('signOut clears the user', async () => {
    fakeSupabase.setStoredSession(makeSession(allowedEmail));
    const auth = renderAuth();
    await waitFor(() => expect(auth.current().status).toBe('authenticated'));

    await act(() => auth.current().signOut());

    expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.current().status).toBe('unauthenticated');
    expect(auth.current().session).toBeNull();
    expect(auth.current().user).toBeNull();
    expect(auth.current().profile).toBeNull();
    expect(auth.current().role).toBeNull();
    expect(auth.current().error).toBeNull();
  });

  it('signOut clears an access-denied error', async () => {
    fakeSupabase.setStoredSession(makeSession('mallory@gmail.com'));
    const auth = renderAuth();
    await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'));
    expect(auth.current().error).toBe(ACCESS_DENIED_MESSAGE);

    await act(() => auth.current().signOut());

    expect(auth.current().error).toBeNull();
    expect(auth.current().status).toBe('unauthenticated');
  });

  it('clearError removes the message', async () => {
    fakeSupabase.setStoredSession(makeSession('mallory@gmail.com'));
    const auth = renderAuth();
    await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'));
    expect(auth.current().error).toBe(ACCESS_DENIED_MESSAGE);

    act(() => auth.current().clearError());

    expect(auth.current().error).toBeNull();
  });

  describe('profile and role', () => {
    it("exposes the user's profile and role once it has loaded", async () => {
      const session = makeSession(allowedEmail, { full_name: 'Ada Lovelace' });
      fakeSupabase.setStoredSession(session);
      const auth = renderAuth();

      await waitFor(() => expect(auth.current().status).toBe('authenticated'));

      expect(fakeSupabase.profileRequests()).toEqual([session.user.id]);
      expect(auth.current().role).toBe('user');
      expect(auth.current().profile).toEqual({
        id: session.user.id,
        email: allowedEmail,
        fullName: 'Ada Lovelace',
        avatarUrl: null,
        role: 'user',
        createdAt: expect.any(String),
        lastSignInAt: null,
      });
    });

    it('exposes the admin role', async () => {
      const session = makeSession(allowedEmail);
      fakeSupabase.setStoredSession(session);
      fakeSupabase.setRole(session.user.id, 'admin');
      const auth = renderAuth();

      await waitFor(() => expect(auth.current().status).toBe('authenticated'));
      expect(auth.current().role).toBe('admin');
    });

    it('stays loading, exposing nothing, until the profile has loaded', async () => {
      const session = makeSession(allowedEmail);
      fakeSupabase.setStoredSession(session);
      const releaseProfile = fakeSupabase.holdProfileRequests();
      const auth = renderAuth();

      await waitFor(() => expect(fakeSupabase.profileRequests()).toEqual([session.user.id]));
      // Let any pending updates land: the profile request is still held.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(auth.current().status).toBe('loading');
      expect(auth.current().session).toBeNull();
      expect(auth.current().user).toBeNull();
      expect(auth.current().profile).toBeNull();
      expect(auth.current().role).toBeNull();
      expect(auth.statuses()).not.toContain('authenticated');

      await act(async () => releaseProfile());
      await waitFor(() => expect(auth.current().status).toBe('authenticated'));
      expect(auth.current().profile?.id).toBe(session.user.id);
    });

    it('also waits for the profile after a new sign-in', async () => {
      const auth = renderAuth();
      await waitFor(() => expect(auth.current().status).toBe('unauthenticated'));
      const releaseProfile = fakeSupabase.holdProfileRequests();
      const session = makeSession(allowedEmail);

      act(() => {
        fakeSupabase.signIn(session);
      });
      await waitFor(() => expect(auth.current().status).toBe('loading'));
      expect(auth.statuses()).not.toContain('authenticated');

      await act(async () => releaseProfile());
      await waitFor(() => expect(auth.current().status).toBe('authenticated'));
      expect(auth.current().role).toBe('user');
    });

    it('signs out with a message when the profile request fails', async () => {
      fakeSupabase.setStoredSession(makeSession(allowedEmail));
      fakeSupabase.failProfileRequests();
      const auth = renderAuth();

      await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'));

      expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(auth.current().status).toBe('unauthenticated');
      expect(auth.current().error).toBe(PROFILE_MESSAGES.failed);
      expect(auth.current().session).toBeNull();
      expect(auth.current().profile).toBeNull();
      expect(auth.current().role).toBeNull();
      expect(auth.statuses()).not.toContain('authenticated');
    });

    it('signs out with a message when there is no profile row', async () => {
      const session = makeSession(allowedEmail);
      fakeSupabase.setStoredSession(session);
      fakeSupabase.deleteProfile(session.user.id);
      const auth = renderAuth();

      await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'));

      expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(auth.current().status).toBe('unauthenticated');
      expect(auth.current().error).toBe(PROFILE_MESSAGES.missing);
      expect(auth.statuses()).not.toContain('authenticated');
    });

    it('keeps the loaded profile on a token refresh instead of reloading it', async () => {
      const session = makeSession(allowedEmail);
      fakeSupabase.setStoredSession(session);
      const auth = renderAuth();
      await waitFor(() => expect(auth.current().status).toBe('authenticated'));
      const rendersBefore = auth.statuses().length;

      const refreshed = { ...session, access_token: 'access-refreshed' };
      act(() => {
        fakeSupabase.refreshToken(refreshed);
      });

      await waitFor(() => expect(auth.current().session?.access_token).toBe('access-refreshed'));
      expect(auth.statuses().slice(rendersBefore)).not.toContain('loading');
      expect(fakeSupabase.profileRequests()).toHaveLength(1);
      expect(auth.current().role).toBe('user');
    });
  });

  it('unsubscribes from auth changes on unmount', async () => {
    const { unmount } = render(
      <AuthProvider>
        <></>
      </AuthProvider>,
    );
    const subscription =
      fakeSupabase.auth.onAuthStateChange.mock.results[0].value.data.subscription;

    unmount();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
