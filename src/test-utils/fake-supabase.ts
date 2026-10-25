import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/**
 * In-memory stand-in for the Supabase client, for tests. It mimics the behaviour the app relies on:
 * getSession() restores a stored session, listeners get INITIAL_SESSION right after subscribing,
 * signOut() clears the session and emits SIGNED_OUT, and from('profiles') reads a profiles table
 * that gets a 'user' row for every signed-in user, like the database trigger. Everything else (the
 * auth context, guards, domain check) runs for real.
 *
 * Use it with:
 *   jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);
 */

type Listener = (event: AuthChangeEvent, session: Session | null) => void | Promise<void>;

/** A public.profiles row as the database returns it. */
export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type QueryError = { message: string; details: string; hint: string; code: string };

let storedSession: Session | null = null;
let restoreGate: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();
const emitted: AuthChangeEvent[] = [];

const profiles = new Map<string, ProfileRow>();
const profileRequests: string[] = [];
let profileGate: Promise<void> = Promise.resolve();
let profileError: QueryError | null = null;

function emit(event: AuthChangeEvent, session: Session | null) {
  emitted.push(event);
  for (const listener of [...listeners]) void listener(event, session);
}

/** What the create_profile_on_signup trigger does: every user gets a 'user' profile. */
function ensureProfile(session: Session) {
  const { user } = session;
  if (profiles.has(user.id)) return;
  const metadata: Record<string, unknown> = user.user_metadata ?? {};
  profiles.set(user.id, {
    id: user.id,
    email: user.email ?? '',
    full_name: (metadata.full_name ?? metadata.name ?? null) as string | null,
    avatar_url: (metadata.avatar_url ?? metadata.picture ?? null) as string | null,
    role: 'user',
    created_at: new Date(0).toISOString(),
    last_sign_in_at: null,
  });
}

/** Supports the one query the app makes: from(table).select(...).eq('id', id).maybeSingle(). */
function from(table: string) {
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return query;
    },
    maybeSingle: async () => {
      const id = String(filters.id);
      if (table === 'profiles') profileRequests.push(id);
      // A network request, so it resolves on a later task, like signOut().
      await new Promise((resolve) => setTimeout(resolve, 0));
      await profileGate;
      if (table !== 'profiles') {
        const message = `relation "public.${table}" does not exist`;
        return { data: null, error: { message, details: '', hint: '', code: '42P01' } };
      }
      if (profileError) return { data: null, error: profileError };
      return { data: profiles.get(id) ?? null, error: null };
    },
  };
  return query;
}

const auth = {
  getSession: jest.fn(async () => {
    await restoreGate;
    return { data: { session: storedSession }, error: null };
  }),
  onAuthStateChange: jest.fn((listener: Listener) => {
    listeners.add(listener);
    queueMicrotask(() => {
      if (listeners.has(listener)) void listener('INITIAL_SESSION', storedSession);
    });
    return {
      data: { subscription: { unsubscribe: jest.fn(() => listeners.delete(listener)) } },
    };
  }),
  signOut: jest.fn(async () => {
    // The real call is a network request. Resolving on a later task (not a microtask) lets React
    // render in between, as it would in the app, so tests can catch a briefly visible state.
    await new Promise((resolve) => setTimeout(resolve, 0));
    storedSession = null;
    emit('SIGNED_OUT', null);
    return { error: null };
  }),
  signInWithOAuth: jest.fn(),
  exchangeCodeForSession: jest.fn(),
};

const client = { auth, from: jest.fn(from) };

export const supabaseModule = { supabase: client };

export const fakeSupabase = {
  auth,
  from: client.from,
  /** The session getSession() restores, as if left in storage by an earlier visit. */
  setStoredSession(session: Session | null) {
    storedSession = session;
    if (session) ensureProfile(session);
  },
  /** Holds getSession() pending until the returned function is called. */
  holdRestore(): () => void {
    let release = () => {};
    restoreGate = new Promise((resolve) => {
      release = resolve;
    });
    return release;
  },
  /** A sign-in completing, e.g. after the OAuth redirect: stores the session, emits SIGNED_IN. */
  signIn(session: Session) {
    storedSession = session;
    ensureProfile(session);
    emit('SIGNED_IN', session);
  },
  /** A token refresh for the current session. */
  refreshToken(session: Session) {
    storedSession = session;
    emit('TOKEN_REFRESHED', session);
  },
  setRole(userId: string, role: 'admin' | 'user') {
    const row = profiles.get(userId);
    if (!row) throw new Error(`No profile for ${userId}`);
    profiles.set(userId, { ...row, role });
  },
  /** As if the row was never created (or RLS hides it). */
  deleteProfile(userId: string) {
    profiles.delete(userId);
  },
  /** Makes profile requests fail, e.g. with a network error. */
  failProfileRequests(message = 'TypeError: Network request failed') {
    profileError = { message, details: '', hint: '', code: '' };
  },
  /** Holds profile requests pending until the returned function is called. */
  holdProfileRequests(): () => void {
    let release = () => {};
    profileGate = new Promise((resolve) => {
      release = resolve;
    });
    return release;
  },
  /** User ids whose profile was requested, in order. */
  profileRequests(): string[] {
    return [...profileRequests];
  },
  /**
   * Events emitted so far (INITIAL_SESSION aside). signOut() emits SIGNED_OUT a task later, so
   * `await waitFor(() => expect(fakeSupabase.emittedEvents()).toContain('SIGNED_OUT'))` both checks
   * it happened and keeps the resulting state update inside act().
   */
  emittedEvents(): AuthChangeEvent[] {
    return [...emitted];
  },
  reset() {
    storedSession = null;
    restoreGate = Promise.resolve();
    listeners.clear();
    emitted.length = 0;
    profiles.clear();
    profileRequests.length = 0;
    profileGate = Promise.resolve();
    profileError = null;
    for (const fn of Object.values(auth)) fn.mockClear();
    client.from.mockClear();
  },
};

let nextId = 1;

/** A Supabase session for `email`, shaped like what Google sign-in returns. */
export function makeSession(email: string, metadata: Record<string, unknown> = {}): Session {
  const id = `user-${nextId++}`;
  return {
    access_token: `access-${id}`,
    refresh_token: `refresh-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id,
      email,
      aud: 'authenticated',
      app_metadata: { provider: 'google' },
      user_metadata: metadata,
      created_at: new Date(0).toISOString(),
    },
  };
}
