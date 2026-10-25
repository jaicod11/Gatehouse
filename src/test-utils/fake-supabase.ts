import {
  AuthPKCECodeVerifierMissingError,
  type AuthChangeEvent,
  type AuthError,
  type Session,
} from '@supabase/supabase-js';

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
let listRequests = 0;
let listGate: Promise<void> = Promise.resolve();
let listFailures: QueryError[] = [];
let rpcFailures: QueryError[] = [];
let rpcGate: Promise<void> = Promise.resolve();

function queryError(code: string, message: string): QueryError {
  return { message, details: '', hint: '', code };
}

/** A network request: resolves on a later task, so React can render in between. */
function networkDelay() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The caller's profile, from the stored session (what auth.uid() would be). */
function callerProfile(): ProfileRow | undefined {
  return storedSession ? profiles.get(storedSession.user.id) : undefined;
}

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

/**
 * Supports the queries the app makes on profiles: one row with .eq('id', id).maybeSingle(), and
 * the list, awaited after .order(). Like RLS, the list holds every row for an admin and only
 * their own row for anyone else.
 */
function from(table: string) {
  const filters: Record<string, unknown> = {};

  const runList = async () => {
    listRequests++;
    await networkDelay();
    await listGate;
    if (table !== 'profiles') {
      return {
        data: null,
        error: queryError('42P01', `relation "public.${table}" does not exist`),
      };
    }
    const failure = listFailures.shift();
    if (failure) return { data: null, error: failure };
    const caller = callerProfile();
    const visible = [...profiles.values()].filter(
      (row) => caller?.role === 'admin' || row.id === caller?.id,
    );
    visible.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return { data: visible, error: null };
  };

  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return query;
    },
    order: () => query,
    maybeSingle: async () => {
      const id = String(filters.id);
      if (table === 'profiles') profileRequests.push(id);
      await networkDelay();
      await profileGate;
      if (table !== 'profiles') {
        return {
          data: null,
          error: queryError('42P01', `relation "public.${table}" does not exist`),
        };
      }
      if (profileError) return { data: null, error: profileError };
      return { data: profiles.get(id) ?? null, error: null };
    },
    // Awaiting the builder itself runs the list query, as with postgrest-js.
    then<T>(onFulfilled: (value: Awaited<ReturnType<typeof runList>>) => T, onRejected?: () => T) {
      return runList().then(onFulfilled, onRejected);
    },
  };
  return query;
}

/** public.set_user_role, with the same checks as the SQL function. */
async function rpc(name: string, args: Record<string, unknown>) {
  await networkDelay();
  await rpcGate;
  if (name !== 'set_user_role') {
    return { data: null, error: queryError('PGRST202', `Could not find the function ${name}`) };
  }
  const failure = rpcFailures.shift();
  if (failure) return { data: null, error: failure };

  const target = String(args.target);
  const role = args.new_role;
  if (role !== 'admin' && role !== 'user') {
    return { data: null, error: queryError('22023', "Role must be 'admin' or 'user'.") };
  }
  const caller = callerProfile();
  if (caller?.role !== 'admin') {
    return { data: null, error: queryError('42501', 'Only admins can change roles.') };
  }
  if (target === caller.id && role !== 'admin') {
    return { data: null, error: queryError('42501', "Admins can't remove their own admin role.") };
  }
  const row = profiles.get(target);
  if (!row) return { data: null, error: queryError('P0002', 'No profile for that user.') };
  const updated = { ...row, role };
  profiles.set(target, updated);
  return { data: updated, error: null };
}

type ExchangeResult = { data: { session: unknown; user: unknown }; error: AuthError | null };

/** supabase-js's answer when no code verifier is stored: no sign-in is waiting for that code. */
async function noPendingSignIn(_code: string): Promise<ExchangeResult> {
  return { data: { session: null, user: null }, error: new AuthPKCECodeVerifierMissingError() };
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
  exchangeCodeForSession: jest.fn(noPendingSignIn),
};

const client = { auth, from: jest.fn(from), rpc: jest.fn(rpc) };

export const supabaseModule = { supabase: client };

export const fakeSupabase = {
  auth,
  from: client.from,
  rpc: client.rpc,
  /** Adds another user's profile, as if they had signed up. Returns the row. */
  addProfile(row: Partial<ProfileRow> & { email: string }): ProfileRow {
    const id = row.id ?? `user-${nextId++}`;
    const full: ProfileRow = {
      full_name: null,
      avatar_url: null,
      role: 'user',
      created_at: new Date(0).toISOString(),
      last_sign_in_at: null,
      ...row,
      id,
    };
    profiles.set(id, full);
    return full;
  },
  updateProfile(userId: string, changes: Partial<Omit<ProfileRow, 'id'>>) {
    const row = profiles.get(userId);
    if (!row) throw new Error(`No profile for ${userId}`);
    profiles.set(userId, { ...row, ...changes });
  },
  profile(userId: string): ProfileRow | undefined {
    return profiles.get(userId);
  },
  /** Makes the next `count` list requests fail. */
  failListRequests(count = 1, message = 'TypeError: Network request failed') {
    listFailures = Array.from({ length: count }, () => queryError('', message));
  },
  /** Holds list requests pending until the returned function is called. */
  holdListRequests(): () => void {
    let release = () => {};
    listGate = new Promise((resolve) => {
      release = resolve;
    });
    return release;
  },
  listRequestCount(): number {
    return listRequests;
  },
  /** Holds RPC calls pending until the returned function is called. */
  holdRpc(): () => void {
    let release = () => {};
    rpcGate = new Promise((resolve) => {
      release = resolve;
    });
    return release;
  },
  /** Makes the next set_user_role call fail with this error. */
  failNextRpc(code: string, message: string) {
    rpcFailures = [queryError(code, message)];
  },
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
    listRequests = 0;
    listGate = Promise.resolve();
    listFailures = [];
    rpcFailures = [];
    rpcGate = Promise.resolve();
    for (const fn of Object.values(auth)) fn.mockClear();
    auth.exchangeCodeForSession.mockImplementation(noPendingSignIn);
    client.from.mockClear();
    client.rpc.mockClear();
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
