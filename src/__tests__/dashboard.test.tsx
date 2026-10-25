import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { env } from '@/config/env';
import { fakeSupabase, makeSession } from '@/test-utils/fake-supabase';

// The real app; only the Supabase client is faked.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);

const MINUTE = 60_000;
const email = `grace.hopper@${env.allowedDomain}`;

/** Signs in Grace with a known profile and a token that expires in 48.5 minutes. */
function signInGrace(role: 'admin' | 'user' = 'user') {
  const base = makeSession(email, { full_name: 'Grace Hopper' });
  const session = { ...base, expires_at: Math.floor((Date.now() + 48.5 * MINUTE) / 1000) };
  fakeSupabase.setStoredSession(session);
  fakeSupabase.updateProfile(session.user.id, {
    role,
    created_at: '2026-10-12T12:00:00Z',
    last_sign_in_at: new Date(Date.now() - 2 * 60 * MINUTE - 5 * MINUTE).toISOString(),
  });
  return session;
}

async function openDashboard() {
  renderRouter('./src/app', { initialUrl: '/dashboard' });
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Grace Hopper' })).toBeTruthy());
}

beforeEach(() => {
  fakeSupabase.reset();
});

describe('dashboard', () => {
  it("shows the user's real profile data", async () => {
    signInGrace();
    await openDashboard();

    expect(screen.getAllByText(email).length).toBeGreaterThan(0);
    expect(screen.getAllByText('User').length).toBeGreaterThan(0);
    expect(screen.getByText('12 Oct 2026')).toBeTruthy();
    expect(screen.getByText('2 hours ago')).toBeTruthy();
  });

  it('shows the session: provider, device, token expiry and platform', async () => {
    signInGrace();
    await openDashboard();

    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText('Signed in on this device')).toBeTruthy();
    expect(screen.getByText('Refreshes in 48 min')).toBeTruthy();
    expect(screen.getByText('iOS')).toBeTruthy(); // jest-expo renders as iOS
  });

  it('keeps the token expiry up to date', async () => {
    signInGrace();
    await openDashboard();

    act(() => {
      jest.advanceTimersByTime(10 * MINUTE);
    });

    expect(await screen.findByText('Refreshes in 38 min')).toBeTruthy();
  });

  it('lists the access checks, with the allowed domain from env', async () => {
    signInGrace();
    await openDashboard();

    for (const check of [
      'Signed in with Google',
      'Email domain verified',
      'Server-side domain check passed',
      'Data protected by row-level security',
      'Role: User',
    ]) {
      expect(screen.getByText(check)).toBeTruthy();
    }
    expect(screen.getByText(`@${env.allowedDomain}`)).toBeTruthy();
  });

  it('hides the admin panel card from normal users', async () => {
    signInGrace('user');
    await openDashboard();

    expect(screen.queryByText('Admin panel')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open admin panel' })).toBeNull();
  });

  it('shows the admin panel card to admins', async () => {
    signInGrace('admin');
    await openDashboard();

    expect(screen.getByText('Admin panel')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open admin panel' })).toBeTruthy();
    expect(screen.getByText('Role: Admin')).toBeTruthy();
  });

  it('shows no invented numbers or placeholder content', async () => {
    signInGrace('admin');
    await openDashboard();

    for (const placeholder of [
      'Team members',
      'Active sessions',
      'Pending invites',
      'Blocked sign-ins',
      'Component preview',
      'Alex Rivera',
      '+3 this week',
    ]) {
      expect(screen.queryByText(placeholder)).toBeNull();
    }
  });

  it('links to the privacy page', async () => {
    signInGrace();
    await openDashboard();

    fireEvent.press(screen.getByRole('link', { name: 'Privacy' }));

    await waitFor(() => expect(screen).toHavePathname('/privacy'));
  });
});
