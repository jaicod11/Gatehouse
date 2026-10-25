import { listProfiles, PROFILE_MESSAGES, ProfilesError, setUserRole } from '@/lib/profiles';
import { fakeSupabase, makeSession } from '@/test-utils/fake-supabase';

// Only the Supabase client is faked; it applies the same rules as RLS and set_user_role.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);

function signInAsAdmin() {
  const session = makeSession('admin@example.com', { full_name: 'Admin' });
  fakeSupabase.setStoredSession(session);
  fakeSupabase.setRole(session.user.id, 'admin');
  return session;
}

beforeEach(() => {
  fakeSupabase.reset();
});

describe('listProfiles', () => {
  it('returns every profile in app naming, oldest first', async () => {
    signInAsAdmin();
    const ada = fakeSupabase.addProfile({
      email: 'ada@example.com',
      full_name: 'Ada Lovelace',
      avatar_url: 'https://img/ada.png',
      created_at: '1999-01-01T00:00:00Z',
      last_sign_in_at: '2026-10-25T10:00:00Z',
    });

    const profiles = await listProfiles();

    // The admin's own row was created in 1970 (the fake's default), Ada's in 1999.
    expect(profiles.map((p) => p.email)).toEqual(['admin@example.com', 'ada@example.com']);
    expect(profiles[1]).toEqual({
      id: ada.id,
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
      avatarUrl: 'https://img/ada.png',
      role: 'user',
      createdAt: '1999-01-01T00:00:00Z',
      lastSignInAt: '2026-10-25T10:00:00Z',
    });
  });

  it('gives an unexpected role the lesser one', async () => {
    signInAsAdmin();
    fakeSupabase.addProfile({ email: 'odd@example.com', role: 'owner' });

    const odd = (await listProfiles()).find((p) => p.email === 'odd@example.com');

    expect(odd?.role).toBe('user');
  });

  it('throws a friendly error when the request fails', async () => {
    signInAsAdmin();
    fakeSupabase.failListRequests(1);

    await expect(listProfiles()).rejects.toThrow(new ProfilesError(PROFILE_MESSAGES.network));
  });
});

describe('setUserRole', () => {
  it('calls set_user_role and returns the updated profile', async () => {
    signInAsAdmin();
    const ada = fakeSupabase.addProfile({ email: 'ada@example.com' });

    const updated = await setUserRole(ada.id, 'admin');

    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_user_role', {
      target: ada.id,
      new_role: 'admin',
    });
    expect(updated).toMatchObject({ id: ada.id, role: 'admin' });
    expect(fakeSupabase.profile(ada.id)?.role).toBe('admin');
  });

  it.each([
    ['42501', 'Only admins can change roles.', PROFILE_MESSAGES.roleForbidden],
    ['42501', "Admins can't remove their own admin role.", PROFILE_MESSAGES.roleSelf],
    ['P0002', 'No profile for that user.', PROFILE_MESSAGES.roleNotFound],
    ['', 'TypeError: Failed to fetch', PROFILE_MESSAGES.network],
    ['XX000', 'internal error with details', PROFILE_MESSAGES.roleFailed],
  ])('maps a %s error to a friendly message', async (code, serverMessage, expected) => {
    signInAsAdmin();
    const ada = fakeSupabase.addProfile({ email: 'ada@example.com' });
    fakeSupabase.failNextRpc(code, serverMessage);

    const error = await setUserRole(ada.id, 'admin').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProfilesError);
    expect((error as ProfilesError).message).toBe(expected);
    expect((error as ProfilesError).code).toBe(code);
  });

  it('is refused for a non-admin by the server rules', async () => {
    fakeSupabase.setStoredSession(makeSession('user@example.com'));
    const ada = fakeSupabase.addProfile({ email: 'ada@example.com' });

    await expect(setUserRole(ada.id, 'admin')).rejects.toThrow(PROFILE_MESSAGES.roleForbidden);
  });
});
