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
  /** "loading" until the stored session has been checked. */
  status: AuthStatus;
  /** Only ever set for a session on the allowed domain. */
  session: Session | null;
  user: AuthUser | null;
  isSigningIn: boolean;
  /** A short message for the user, e.g. ACCESS_DENIED_MESSAGE. */
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

type AuthState = Pick<AuthContextValue, 'status' | 'session' | 'error'>;

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the Supabase session and enforces the domain restriction on the client: a session whose
 * email isn't on the allowed domain is signed out at once and never exposed as "authenticated".
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    status: 'loading',
    session: null,
    error: readWebCallbackError(),
  }));
  const [isSigningIn, setIsSigningIn] = useState(false);
  const signingInRef = useRef(false);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    let rejecting = false;

    const endRejectedSession = async () => {
      if (rejecting) return;
      rejecting = true;
      try {
        await supabase.auth.signOut();
      } catch {
        // Nothing to show: the session is already hidden from the app.
      } finally {
        rejecting = false;
      }
    };

    const applySession = (session: Session | null) => {
      if (!active) return;
      if (!session) {
        // Keep any error, so the SIGNED_OUT that follows a domain rejection keeps its message.
        setState((prev) => ({ status: 'unauthenticated', session: null, error: prev.error }));
      } else if (isAllowedEmail(session.user.email, env.allowedDomain)) {
        setState({ status: 'authenticated', session, error: null });
      } else {
        // Decided in the same update that receives the session, so a wrong-domain user never
        // renders as authenticated, not even for one frame.
        setState({ status: 'unauthenticated', session: null, error: ACCESS_DENIED_MESSAGE });
        void endRejectedSession();
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
      const result = await startGoogleSignIn(env.allowedDomain);
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
    try {
      await supabase.auth.signOut();
    } catch {
      // supabase-js clears the stored session even when the revoke request fails.
    } finally {
      signingInRef.current = false;
      setIsSigningIn(false);
      setState({ status: 'unauthenticated', session: null, error: null });
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
    () => ({ ...state, user, isSigningIn, signInWithGoogle, signOut, clearError }),
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
