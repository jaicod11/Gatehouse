import '../global.css';

import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FullScreenLoader } from '@/components/full-screen-loader';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth-context';

SplashScreen.preventAutoHideAsync();

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent.violet,
    background: colors.background,
    card: colors.surface,
    text: colors.text.primary,
    border: colors.border,
  },
};

/** App-wide providers. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Route protection. A guard that is false removes its screens from the navigator, so a direct URL
 * (or a refresh) on a guarded screen falls back to the index route, which redirects by auth status.
 * Nothing is mounted until the stored session has been checked: no flash of the dashboard or the
 * login page, and a deep link to /dashboard survives the check.
 *
 * Guards run on the client only. Real data must still be protected by Supabase on the server.
 */
function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') return <FullScreenLoader label="Checking your session…" />;

  const signedIn = status === 'authenticated';
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/callback" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Subpath imports pull in only these four weights instead of the whole family.
  const [fontsLoaded, fontError] = useFonts({
    [fonts.regular]: PlusJakartaSans_400Regular,
    [fonts.medium]: PlusJakartaSans_500Medium,
    [fonts.semibold]: PlusJakartaSans_600SemiBold,
    [fonts.bold]: PlusJakartaSans_700Bold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) {
      console.warn('[fonts] Plus Jakarta Sans failed to load; using system font.', fontError);
    }
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);

  // Keep the splash screen up until fonts are ready, so text never renders in the fallback font.
  if (!ready) return null;

  return (
    <Providers>
      <StatusBar style="light" />
      <RootNavigator />
    </Providers>
  );
}
