import { Redirect } from 'expo-router';

import { FullScreenLoader } from '@/components/full-screen-loader';
import { useAuth } from '@/context/auth-context';

// Entry point, and where the guards in the root layout send blocked URLs.
export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  return <Redirect href={status === 'authenticated' ? '/dashboard' : '/login'} />;
}
