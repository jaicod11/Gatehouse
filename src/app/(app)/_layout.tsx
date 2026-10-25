import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

// The signed-in area. Guarded in the root layout: only reachable with an allowed session.
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
