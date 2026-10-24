import { Redirect } from 'expo-router';

// Temporary: once auth lands, this routes to /dashboard or /login based on the session.
export default function Index() {
  return <Redirect href="/login" />;
}
