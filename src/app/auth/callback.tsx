import { Redirect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { FullScreenLoader } from '@/components/full-screen-loader';
import { useAuth } from '@/context/auth-context';
import { callbackFromSearchParams } from '@/lib/oauth-callback';
import { completeOAuthCallback } from '@/lib/oauth-redirect';

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
  const {
    code,
    error,
    error_code: errorCode,
    error_description: errorDescription,
  } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>();
  // iOS / Android: if this URL carries a code or an error, finish the sign-in from it before
  // moving on (e.g. the app was relaunched by the callback after the OS killed it). The same code
  // is never exchanged twice, whoever else sees the URL. On web supabase-js already did this.
  const hasCallback = Platform.OS !== 'web' && !!(code || error || errorCode || errorDescription);
  const [completing, setCompleting] = useState(hasCallback);

  useEffect(() => {
    if (!hasCallback) return;
    let active = true;
    const callback = callbackFromSearchParams({
      code,
      error,
      error_code: errorCode,
      error_description: errorDescription,
    });
    void completeOAuthCallback(callback)?.then(() => {
      if (active) setCompleting(false);
    });
    return () => {
      active = false;
    };
  }, [hasCallback, code, error, errorCode, errorDescription]);

  if (status === 'loading' || isSigningIn || completing) {
    return <FullScreenLoader label="Signing you in…" />;
  }
  return <Redirect href="/" />;
}
