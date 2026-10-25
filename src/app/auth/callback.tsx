import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { FullScreenLoader } from '@/components/full-screen-loader';
import { useAuth } from '@/context/auth-context';

// Expo's auth guides call this on the page an auth session redirects to: it closes the popup when
// WebBrowser.openAuthSessionAsync was used on web. Harmless otherwise (our web flow is a full-page
// redirect, and native resolves openAuthSessionAsync directly).
WebBrowser.maybeCompleteAuthSession();

/**
 * Where Google sign-in returns to. On web, supabase-js has already exchanged the ?code= by the time
 * this renders (the root layout waits for it); on Android the deep link can land here while
 * src/lib/auth.ts is still exchanging the code. Either way: show a loader until that's settled,
 * then hand over to the index route, which redirects by auth status. Opening it directly is safe.
 */
export default function AuthCallback() {
  const { status, isSigningIn } = useAuth();
  if (status === 'loading' || isSigningIn) return <FullScreenLoader label="Signing you in…" />;
  return <Redirect href="/" />;
}
