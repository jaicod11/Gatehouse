import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/**
 * In-memory stand-in for the Supabase client's auth API, for tests. It mimics the behaviour the app
 * relies on: getSession() restores a stored session, listeners get INITIAL_SESSION right after
 * subscribing, and signOut() clears the session and emits SIGNED_OUT. Everything else (the auth
 * context, guards, domain check) runs for real.
 *
 * Use it with:
 *   jest.mock('@/lib/supabase', () => jest.requireActual('@/test-utils/fake-supabase').supabaseModule);
 */

type Listener = (event: AuthChangeEvent, session: Session | null) => void | Promise<void>;

let storedSession: Session | null = null;
let restoreGate: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();

function emit(event: AuthChangeEvent, session: Session | null) {
  for (const listener of [...listeners]) void listener(event, session);
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

export const supabaseModule = { supabase: { auth } };

export const fakeSupabase = {
  auth,
  /** The session getSession() restores, as if left in storage by an earlier visit. */
  setStoredSession(session: Session | null) {
    storedSession = session;
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
    emit('SIGNED_IN', session);
  },
  reset() {
    storedSession = null;
    restoreGate = Promise.resolve();
    listeners.clear();
    for (const fn of Object.values(auth)) fn.mockClear();
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
