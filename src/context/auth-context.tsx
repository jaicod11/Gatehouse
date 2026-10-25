import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { signInWithGoogle as startGoogleSignIn } from '@/lib/auth';
import { readWebCallbackError } from '@/lib/oauth-callback';
import { subscribeToOAuthRedirects } from '@/lib/oauth-redirect';
import { PROFILE_MESSAGES, fetchProfile, type Profile, type UserRole } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { ACCESS_DENIED_MESSAGE, isAllowedEmail } from '@/utils/domain';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type AuthContextValue = {
  /** "loading" until the stored session and, for a valid one, the user's profile are loaded. */
  status: AuthStatus;
  /** Only ever set for a session on the allowed domain whose profile has loaded. */
  session: Session | null;
  user: AuthUser | null;
  /** The user's row in public.profiles; set exactly when status is "authenticated". */
  profile: Profile | null;
  role: UserRole | null;
  isSigningIn: boolean;
  /** A short message for the user, e.g. ACCESS_DENIED_MESSAGE. */
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

type AuthState = Pick<AuthContextValue, 'status' | 'session' | 'profile' | 'error'>;

const SIGNED_OUT: Omit<AuthState, 'error'> = {
  status: 'unauthenticated',
  session: null,
  profile: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the Supabase session and enforces the domain restriction on the client: a session whose
 * email isn't on the allowed domain is signed out at once and never exposed as "authenticated".
 * An allowed session only becomes "authenticated" once the user's profile (and so their role) has
 * loaded; if that fails, the user is signed out with a message instead of being half signed in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    status: 'loading',
    session: null,
    profile: null,
    error: readWebCallbackError(),
  }));
  const [isSigningIn, setIsSigningIn] = useState(false);
  const signingInRef = useRef(false);
  // The user whose profile is loaded or loading, and their latest session, so repeat events for
  // the same user (token refresh, tab refocus, a duplicate SIGNED_IN) don't refetch it.
  const profileUserRef = useRef<string | null>(null);
  const latestSessionRef = useRef<Session | null>(null);
  // Bumped whenever the session is replaced or ended, so a profile request for an older session
  // can't land after it.
  const sessionVersionRef = useRef(0);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    let endingSession = false;

    const forgetSession = () => {
      sessionVersionRef.current++;
      profileUserRef.current = null;
      latestSessionRef.current = null;
    };

    const endSession = async () => {
      if (endingSession) return;
      endingSession = true;
      try {
        await supabase.auth.signOut();
      } catch {
        // Nothing to show: the session is already hidden from the app.
      } finally {
        endingSession = false;
      }
    };

    // Never exposes the session: the state flips to signed out in the same update.
    const reject = (message: string) => {
      forgetSession();
      setState({ ...SIGNED_OUT, error: message });
      void endSession();
    };

    const loadProfile = async (userId: string) => {
      const version = ++sessionVersionRef.current;
      setState({ status: 'loading', session: null, profile: null, error: null });

      let profile: Profile | null = null;
      let failed = false;
      try {
        profile = await fetchProfile(userId);
      } catch {
        failed = true;
      }
      if (!active || version !== sessionVersionRef.current) return;

      if (failed || !profile) {
        reject(failed ? PROFILE_MESSAGES.failed : PROFILE_MESSAGES.missing);
      } else {
        setState({
          status: 'authenticated',
          session: latestSessionRef.current,
          profile,
          error: null,
        });
      }
    };

    const applySession = (session: Session | null) => {
      if (!active) return;
      if (!session) {
        forgetSession();
        // Keep any error, so the SIGNED_OUT that follows a rejection keeps its message.
        setState((prev) => ({ ...SIGNED_OUT, error: prev.error }));
        return;
      }
      if (!isAllowedEmail(session.user.email, env.allowedDomain)) {
        reject(ACCESS_DENIED_MESSAGE);
        return;
      }

      const sameUser = session.user.id === profileUserRef.current;
      profileUserRef.current = session.user.id;
      latestSessionRef.current = session;
      if (sameUser) {
        setState((prev) => (prev.status === 'authenticated' ? { ...prev, session } : prev));
      } else {
        void loadProfile(session.user.id);
      }
    };

    // Restore the stored session (on web this also waits for the ?code= exchange on
    // /auth/callback). If an auth event lands first, it is newer, so this result is dropped.
    supabase.auth.getSession().then(
      ({ data }) => {
        if (!receivedEvent) applySession(data.session);
      },
      () => {
        if (!receivedEvent) applySession(null);
      },
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION repeats what getSession() returns.
      if (event === 'INITIAL_SESSION') return;
      receivedEvent = true;
      applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // iOS / Android: a sign-in can also finish outside signInWithGoogle, e.g. when the OS killed the
  // app while Google's page was open and the callback relaunched it. Show the spinner meanwhile
  // and the error if it fails; success arrives as a SIGNED_IN event like any other sign-in.
  useEffect(
    () =>
      subscribeToOAuthRedirects((event) => {
        if (event.phase === 'started') {
          setIsSigningIn(true);
          setState((prev) => ({ ...prev, error: null }));
          return;
        }
        // An in-app sign-in (signInWithGoogle) turns its own spinner off when it returns.
        if (!signingInRef.current) setIsSigningIn(false);
        const { outcome } = event;
        if (outcome.type === 'error') setState((prev) => ({ ...prev, error: outcome.message }));
      }),
    [],
  );

  // Web: pressing Back on Google's page can restore this page from the back/forward cache with the
  // spinner still showing, because the page never reloaded.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      signingInRef.current = false;
      setIsSigningIn(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (signingInRef.current) return;
    signingInRef.current = true;
    setIsSigningIn(true);
    setState((prev) => ({ ...prev, error: null }));

    let redirecting = false;
    try {
      const result = await startGoogleSignIn();
      redirecting = result.type === 'redirecting';
      if (result.type === 'error') {
        setState((prev) => ({ ...prev, error: result.message }));
      }
    } finally {
      // On web the page is leaving for Google, so keep the spinner until it unloads.
      if (!redirecting) {
        signingInRef.current = false;
        setIsSigningIn(false);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    sessionVersionRef.current++;
    profileUserRef.current = null;
    latestSessionRef.current = null;
    try {
      await supabase.auth.signOut();
    } catch {
      // supabase-js clears the stored session even when the revoke request fails.
    } finally {
      signingInRef.current = false;
      setIsSigningIn(false);
      setState({ ...SIGNED_OUT, error: null });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const user = useMemo(
    () => (state.session ? toAuthUser(state.session.user) : null),
    [state.session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      user,
      role: state.profile?.role ?? null,
      isSigningIn,
      signInWithGoogle,
      signOut,
      clearError,
    }),
    [state, user, isSigningIn, signInWithGoogle, signOut, clearError],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}

function toAuthUser(user: User): AuthUser {
  // Google fills full_name/name and avatar_url/picture in the Supabase user metadata.
  const metadata: Record<string, unknown> = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    fullName: readString(metadata.full_name) ?? readString(metadata.name),
    avatarUrl: readString(metadata.avatar_url) ?? readString(metadata.picture),
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
