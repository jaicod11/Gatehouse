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

import { colors, fonts } from '@/constants/theme';

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

/** App-wide providers. The auth provider goes here in a later step. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>{children}</ThemeProvider>
    </SafeAreaProvider>
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
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </Providers>
  );
}
