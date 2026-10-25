import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { env } from '@/config/env';
import { CONTACT_EMAIL } from '@/constants/legal';
import { fakeSupabase, makeSession } from '@/test-utils/fake-supabase';

// The real app; only the Supabase client is faked.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);

const PRIVACY_HEADING = { name: 'Privacy policy' };

beforeEach(() => {
  fakeSupabase.reset();
});

describe('privacy page', () => {
  it('opens for a signed-out visitor, without a redirect', async () => {
    renderRouter('./src/app', { initialUrl: '/privacy' });

    await waitFor(() => expect(screen.getByRole('heading', PRIVACY_HEADING)).toBeTruthy());
    expect(screen).toHavePathname('/privacy');
    for (const section of [
      'What we collect',
      'Why we use it',
      "Where it's stored",
      'Sharing',
      'Deleting your data',
      'Contact',
    ]) {
      expect(screen.getByRole('heading', { name: section })).toBeTruthy();
    }
    expect(screen.getByText(CONTACT_EMAIL)).toBeTruthy();
    expect(screen.getByText(/^Last updated \d{1,2} [A-Z][a-z]{2} \d{4}$/)).toBeTruthy();
    expect(
      screen.getAllByText(new RegExp(env.allowedDomain.replace(/\./g, '\\.'))).length,
    ).toBeGreaterThan(0);
  });

  it('opens for a signed-in user too', async () => {
    fakeSupabase.setStoredSession(makeSession(`grace@${env.allowedDomain}`));
    renderRouter('./src/app', { initialUrl: '/privacy' });

    await waitFor(() => expect(screen.getByRole('heading', PRIVACY_HEADING)).toBeTruthy());
    expect(screen).toHavePathname('/privacy');
  });

  it('is linked from the login page', async () => {
    renderRouter('./src/app', { initialUrl: '/login' });
    await waitFor(() => expect(screen.getByText('Sign in to Gatehouse')).toBeTruthy());

    fireEvent.press(screen.getByRole('link', { name: 'Privacy' }));

    await waitFor(() => expect(screen).toHavePathname('/privacy'));
    expect(screen.getByRole('heading', PRIVACY_HEADING)).toBeTruthy();
  });
});

describe('not-found page', () => {
  it('shows a themed 404 for an unknown URL', async () => {
    renderRouter('./src/app', { initialUrl: '/no/such/page' });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy(),
    );
    expect(screen.getByText('Error 404')).toBeTruthy();
  });

  it('sends a signed-out visitor home, which then routes to /login', async () => {
    renderRouter('./src/app', { initialUrl: '/no/such/page' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy(),
    );

    fireEvent.press(screen.getByRole('link', { name: 'Back to home' }));

    await waitFor(() => expect(screen).toHavePathname('/login'));
  });

  it('sends a signed-in user home, which then routes to /dashboard', async () => {
    fakeSupabase.setStoredSession(
      makeSession(`grace@${env.allowedDomain}`, { full_name: 'Grace' }),
    );
    renderRouter('./src/app', { initialUrl: '/no/such/page' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy(),
    );

    fireEvent.press(screen.getByRole('link', { name: 'Back to home' }));

    await waitFor(() => expect(screen).toHavePathname('/dashboard'));
  });
});
