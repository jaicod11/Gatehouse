import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

// Signed-out screens. Guarded in the root layout: signed-in users are sent to the dashboard.
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
