import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { env } from '@/config/env';
import { fakeSupabase, makeSession } from '@/test-utils/fake-supabase';
import { ACCESS_DENIED_MESSAGE } from '@/utils/domain';

// Renders the real routes in src/app (root layout with its guards, index, callback, login and
// dashboard). Only the Supabase client is faked.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);

const APP_DIR = './src/app';
const allowedEmail = `grace.hopper@${env.allowedDomain}`;
const LOGIN_HEADING = 'Sign in to Gatehouse';

function signedInAs(email: string) {
  fakeSupabase.setStoredSession(makeSession(email, { full_name: 'Grace Hopper' }));
}

beforeEach(() => {
  fakeSupabase.reset();
});

describe('route guards', () => {
  it('sends a signed-out visitor from /dashboard to /login', async () => {
    renderRouter(APP_DIR, { initialUrl: '/dashboard' });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(screen.getByText(LOGIN_HEADING)).toBeTruthy();
    expect(screen.queryByText('Grace Hopper')).toBeNull();
  });

  it('sends a signed-in user from /login to /dashboard', async () => {
    signedInAs(allowedEmail);
    renderRouter(APP_DIR, { initialUrl: '/login' });

    await waitFor(() => expect(screen).toHavePathname('/dashboard'));
    expect(screen.getByText(allowedEmail)).toBeTruthy();
    expect(screen.queryByText(LOGIN_HEADING)).toBeNull();
  });

  it('keeps a signed-in user on a deep link to /dashboard', async () => {
    signedInAs(allowedEmail);
    renderRouter(APP_DIR, { initialUrl: '/dashboard' });

    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeTruthy());
    expect(screen).toHavePathname('/dashboard');
  });

  it('shows only the loader while the session is being restored', async () => {
    signedInAs(allowedEmail);
    const finishRestore = fakeSupabase.holdRestore();
    renderRouter(APP_DIR, { initialUrl: '/dashboard' });

    expect(screen.getByLabelText('Checking your session…')).toBeTruthy();
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    expect(screen.queryByText(LOGIN_HEADING)).toBeNull();

    await act(async () => finishRestore());
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeTruthy());
    expect(screen).toHavePathname('/dashboard');
  });

  it('keeps a wrong-domain session out and shows the access-denied message', async () => {
    signedInAs(`grace@x${env.allowedDomain}`);
    renderRouter(APP_DIR, { initialUrl: '/dashboard' });

    await waitFor(() => expect(screen).toHavePathname('/login'));
    await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'));
    expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeTruthy();
    expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Grace Hopper')).toBeNull();
  });

  it('lands on /login after signing out from the dashboard', async () => {
    signedInAs(allowedEmail);
    renderRouter(APP_DIR, { initialUrl: '/dashboard' });
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen).toHavePathname('/login'));
    expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText(LOGIN_HEADING)).toBeTruthy();
  });

  it('forwards a direct visit to /auth/callback without a session to /login', async () => {
    renderRouter(APP_DIR, { initialUrl: '/auth/callback' });

    await waitFor(() => expect(screen).toHavePathname('/login'));
  });

  it('forwards /auth/callback to /dashboard once the session is in place', async () => {
    signedInAs(allowedEmail);
    renderRouter(APP_DIR, { initialUrl: '/auth/callback?code=abc' });

    await waitFor(() => expect(screen).toHavePathname('/dashboard'));
  });
});
