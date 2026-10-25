import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { Compass, House } from 'lucide-react-native';
import { View } from 'react-native';

import { PageFooter } from '@/components/page-footer';
import {
  Appear,
  Body,
  Button,
  Caption,
  GlassCard,
  GradientBackground,
  Heading,
  Screen,
} from '@/components/ui';
import { colors } from '@/constants/theme';

// Any URL no route matches. "Back to home" goes to the index route, which sends the visitor to
// the dashboard or the login page depending on their session.
export default function NotFoundScreen() {
  return (
    <Screen
      background={<GradientBackground />}
      scroll
      className="items-center justify-center px-4 py-12 md:px-8"
    >
      <Head>
        <title>Page not found · Gatehouse</title>
      </Head>

      <Appear index={0} style={{ width: '100%', maxWidth: 440 }}>
        <GlassCard padding="lg">
          <View className="size-12 items-center justify-center rounded-lg border border-border bg-white/[0.04]">
            <Compass size={22} color={colors.accent.cyan} strokeWidth={2} />
          </View>
          <Caption variant="overline" className="mt-6">
            Error 404
          </Caption>
          <Heading level={2} className="mt-1">
            Page not found
          </Heading>
          <Body tone="secondary" className="mt-2">
            This page doesn&apos;t exist or has moved.
          </Body>
          <View className="mt-8 flex-row">
            <Link href="/" replace asChild>
              <Button label="Back to home" leftIcon={House} />
            </Link>
          </View>
        </GlassCard>
      </Appear>

      <PageFooter className="mt-10" />
    </Screen>
  );
}
