import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import {
  Badge,
  Body,
  Button,
  Caption,
  GlassCard,
  GradientBackground,
  Heading,
  Screen,
} from '@/components/ui';

// Placeholder for the admin area; user management arrives in the next step.
export default function AdminScreen() {
  return (
    <Screen
      background={<GradientBackground />}
      scroll
      className="items-center justify-center px-4 py-12 md:px-8"
    >
      <Head>
        <title>Admin · Gatehouse</title>
      </Head>

      <GlassCard className="w-full max-w-[560px]" padding="lg">
        <Badge tone="accent" icon={ShieldCheck} label="Admins only" />
        <Caption variant="overline" className="mt-6">
          Admin
        </Caption>
        <Heading level={2} className="mt-1">
          Admin area
        </Heading>
        <Body tone="secondary" className="mt-2">
          User and role management will live here.
        </Body>

        <View className="mt-8 flex-row">
          <Link href="/dashboard" asChild>
            <Button variant="secondary" size="sm" label="Back to dashboard" leftIcon={ArrowLeft} />
          </Link>
        </View>
      </GlassCard>
    </Screen>
  );
}
