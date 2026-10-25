import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

// The signed-in area. Guarded in the root layout: only reachable with an allowed session.
// Inside it, /admin is only reachable for admins. A blocked visit falls back to the first screen
// here, the dashboard. This is UI only; the data itself is protected by RLS in Supabase.
export default function AppLayout() {
  const { role } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}
