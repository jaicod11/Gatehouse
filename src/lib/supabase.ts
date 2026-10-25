import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/config/env';

// Native: adds crypto.getRandomValues and crypto.subtle.digest (via expo-crypto) so supabase-js
// can use a secure PKCE verifier and the S256 challenge. Must load before the client is used.
import './crypto-shim';
import { sessionStorageAdapter } from './session-storage';

const isWeb = Platform.OS === 'web';

/**
 * The app's single Supabase client. It uses the publishable (anon) key, which is meant to ship in
 * clients; the secret / service_role key must never be used here. Never log the session or tokens.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    // SecureStore (Keychain / Keystore) on native; supabase-js's default localStorage on web.
    storage: sessionStorageAdapter,
    // On web, the client finishes the OAuth redirect itself by exchanging the ?code= that Supabase
    // appends to /auth/callback. Native apps have no page URL, so src/lib/auth.ts does it instead.
    detectSessionInUrl: isWeb,
  },
});

// Native apps get no browser visibility events, so refresh tokens only while the app is in the
// foreground, as the Supabase React Native guide recommends.
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
