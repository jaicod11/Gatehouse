import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

// The signed-in area. The auth guard that redirects to /login goes here in a later step.
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
