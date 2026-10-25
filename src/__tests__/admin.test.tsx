import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { env } from '@/config/env';
import { PROFILE_MESSAGES } from '@/lib/profiles';
import { fakeSupabase, makeSession, type ProfileRow } from '@/test-utils/fake-supabase';

// The real app; only the Supabase client is faked. It applies the same rules as RLS and
// set_user_role, so the admin sees everyone and role changes really change the fake table.
jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);

const DAY = 24 * 60 * 60_000;
const at = (domainUser: string) => `${domainUser}@${env.allowedDomain}`;

let me: string;
let ada: ProfileRow;
let alan: ProfileRow;
let linus: ProfileRow;

function seed() {
  const session = makeSession(at('grace'), { full_name: 'Grace Hopper' });
  fakeSupabase.setStoredSession(session);
  fakeSupabase.updateProfile(session.user.id, {
    role: 'admin',
    created_at: '2026-01-05T12:00:00Z',
  });
  me = session.user.id;
  ada = fakeSupabase.addProfile({
    email: at('ada'),
    full_name: 'Ada Lovelace',
    created_at: '2026-09-01T12:00:00Z',
    last_sign_in_at: new Date(Date.now() - 3 * DAY).toISOString(),
  });
  alan = fakeSupabase.addProfile({
    email: at('alan.turing'),
    full_name: 'Alan Turing',
    role: 'admin',
    created_at: '2026-09-02T12:00:00Z',
  });
  linus = fakeSupabase.addProfile({ email: at('linus'), created_at: '2026-09-03T12:00:00Z' });
}

async function openAdmin() {
  renderRouter('./src/app', { initialUrl: '/admin' });
  await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeTruthy());
}

const row = (profile: { id: string }) => within(screen.getByTestId(`user-row-${profile.id}`));
const dialog = () => within(screen.getByTestId('confirm-dialog'));

beforeEach(() => {
  fakeSupabase.reset();
  seed();
});

describe('admin panel', () => {
  it('lists every profile with real summary counts', async () => {
    await openAdmin();

    expect(screen.getByLabelText('Total users: 4')).toBeTruthy();
    expect(screen.getByLabelText('Admins: 2')).toBeTruthy();
    expect(screen.getByLabelText('Users: 2')).toBeTruthy();

    expect(row(ada).getByText(at('ada'))).toBeTruthy();
    expect(row(ada).getByText('1 Sep 2026')).toBeTruthy();
    expect(row(ada).getByText('3 days ago')).toBeTruthy();
    expect(row(alan).getByText('Admin')).toBeTruthy();
    // No name: the email stands in, and a user who never signed in says so.
    expect(row(linus).getAllByText(at('linus'))).toHaveLength(1);
    expect(row(linus).getByText('Never')).toBeTruthy();
  });

  it('shows skeletons while the list loads', async () => {
    const release = fakeSupabase.holdListRequests();
    renderRouter('./src/app', { initialUrl: '/admin' });

    await waitFor(() => expect(screen.getByLabelText('Loading users')).toBeTruthy());
    expect(screen.getByLabelText('Total users: loading')).toBeTruthy();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();

    await act(async () => release());
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeTruthy());
    expect(screen.queryByLabelText('Loading users')).toBeNull();
  });

  it('filters by name or email', async () => {
    await openAdmin();
    const search = screen.getByLabelText('Search by name or email');

    fireEvent.changeText(search, 'LOVELACE');
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.queryByText('Alan Turing')).toBeNull();
    expect(screen.getByText('1 of 4')).toBeTruthy();

    fireEvent.changeText(search, 'alan.turing@');
    expect(screen.getByText('Alan Turing')).toBeTruthy();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
  });

  it('shows an empty state when nobody matches, with a way back', async () => {
    await openAdmin();

    fireEvent.changeText(screen.getByLabelText('Search by name or email'), 'zzz');
    expect(screen.getByText('No users match “zzz”')).toBeTruthy();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Show everyone' }));
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Alan Turing')).toBeTruthy();
  });

  it('asks for confirmation, calls the RPC, shows a toast and refreshes the list', async () => {
    await openAdmin();
    const requestsBefore = fakeSupabase.listRequestCount();

    fireEvent.press(screen.getByRole('button', { name: 'Make admin: Ada Lovelace' }));
    expect(screen.getByText('Make Ada Lovelace an admin?')).toBeTruthy();
    expect(fakeSupabase.rpc).not.toHaveBeenCalled();

    fireEvent.press(dialog().getByRole('button', { name: 'Make admin' }));

    await waitFor(() => expect(screen.getByText('Role updated')).toBeTruthy());
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('set_user_role', {
      target: ada.id,
      new_role: 'admin',
    });
    expect(screen.getByText('Ada Lovelace is now an admin.')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Admins: 3')).toBeTruthy());
    expect(fakeSupabase.listRequestCount()).toBe(requestsBefore + 1);
    expect(row(ada).getByText('Admin')).toBeTruthy();
    expect(row(ada).getByRole('button', { name: 'Make user: Ada Lovelace' })).toBeTruthy();
  });

  it('shows a loading state on the row while the change is saved', async () => {
    await openAdmin();
    const release = fakeSupabase.holdRpc();

    fireEvent.press(screen.getByRole('button', { name: 'Make user: Alan Turing' }));
    fireEvent.press(dialog().getByRole('button', { name: 'Make user' }));

    await waitFor(() =>
      expect(row(alan).getByRole('button', { name: 'Make user: Alan Turing' })).toBeBusy(),
    );

    await act(async () => release());
    await waitFor(() => expect(screen.getByText('Alan Turing is now a user.')).toBeTruthy());
  });

  it('does nothing when the dialog is cancelled', async () => {
    await openAdmin();

    fireEvent.press(screen.getByRole('button', { name: 'Make admin: Ada Lovelace' }));
    fireEvent.press(dialog().getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Make Ada Lovelace an admin?')).toBeNull());
    expect(fakeSupabase.rpc).not.toHaveBeenCalled();
  });

  it("disables the action on the admin's own row, with an explanation", async () => {
    await openAdmin();

    const own = row({ id: me }).getByRole('button', { name: "You can't change your own role" });
    expect(own).toBeDisabled();
    expect(row({ id: me }).getByText("You can't change your own role")).toBeTruthy();

    fireEvent.press(own);
    expect(screen.queryByText(/^Make Grace Hopper/)).toBeNull();
  });

  it('shows an error toast with a friendly message when the change fails', async () => {
    await openAdmin();
    const requestsBefore = fakeSupabase.listRequestCount();
    fakeSupabase.failNextRpc('42501', 'Only admins can change roles.');

    fireEvent.press(screen.getByRole('button', { name: 'Make admin: Ada Lovelace' }));
    fireEvent.press(dialog().getByRole('button', { name: 'Make admin' }));

    await waitFor(() => expect(screen.getByText("Couldn't change the role")).toBeTruthy());
    expect(screen.getByText(PROFILE_MESSAGES.roleForbidden)).toBeTruthy();
    expect(screen.queryByText('Only admins can change roles.')).toBeNull();
    expect(fakeSupabase.listRequestCount()).toBe(requestsBefore);
    expect(row(ada).getByText('User')).toBeTruthy();
  });

  it('shows an error state with a Retry button when the list fails to load', async () => {
    fakeSupabase.failListRequests(1);
    renderRouter('./src/app', { initialUrl: '/admin' });

    await waitFor(() => expect(screen.getByText("Couldn't load users")).toBeTruthy());
    expect(screen.getByText(PROFILE_MESSAGES.network)).toBeTruthy();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeTruthy());
    expect(screen.queryByText("Couldn't load users")).toBeNull();
  });
});
