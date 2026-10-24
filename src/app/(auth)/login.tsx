import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { LayoutDashboard, LogIn, ShieldCheck, Smartphone, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LogoMark } from '@/components/logo-mark';
import {
  Badge,
  Body,
  Button,
  Caption,
  GlassCard,
  GradientBackground,
  Heading,
  Screen,
  Text,
  type IconComponent,
} from '@/components/ui';
import { env } from '@/config/env';
import { colors } from '@/constants/theme';

const FEATURES: { icon: IconComponent; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Google Workspace sign-in',
    body: `Only @${env.allowedDomain} accounts get through.`,
  },
  {
    icon: Smartphone,
    title: 'Everywhere you work',
    body: 'One app for iOS, Android and the web.',
  },
  {
    icon: Zap,
    title: 'Straight to your tools',
    body: 'Sign in once and pick up where you left off.',
  },
];

// Placeholder screen for checking the design system. Google sign-in arrives in a later step.
export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Demo only: show the button's loading state for a moment.
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 1600);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <Screen
      background={<GradientBackground />}
      scroll
      className="items-center justify-center px-4 py-12 md:px-8"
    >
      <Head>
        <title>Sign in · Gatehouse</title>
      </Head>

      <View className="w-full max-w-[1080px] items-center gap-16 lg:flex-row lg:justify-between">
        {/* Hero, wide screens only. */}
        <View className="hidden max-w-[500px] flex-1 lg:flex">
          <Badge tone="accent" dot label="Internal access" />
          <Heading level={1} className="mt-6">
            The front door for the {env.allowedDomain} team.
          </Heading>
          <Body size="lg" tone="secondary" className="mt-5">
            Gatehouse keeps internal tools behind your company Google account, so the right people
            get in and nobody else does.
          </Body>
          <View className="mt-10 gap-6">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <View key={title} className="flex-row items-center gap-4">
                <View className="size-11 items-center justify-center rounded-lg border border-border bg-white/[0.04]">
                  <Icon size={20} color={colors.accent.cyan} strokeWidth={2} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text weight="semibold" className="text-base leading-6">
                    {title}
                  </Text>
                  <Body size="sm" tone="secondary">
                    {body}
                  </Body>
                </View>
              </View>
            ))}
          </View>
        </View>

        <GlassCard className="w-full max-w-[440px]" padding="lg">
          <LogoMark />
          <Heading level={2} className="mt-8">
            Sign in to Gatehouse
          </Heading>
          <Body tone="secondary" className="mt-2">
            Use your {env.allowedDomain} Google account to continue.
          </Body>

          <Button
            className="mt-8"
            fullWidth
            size="lg"
            label="Continue with Google"
            leftIcon={LogIn}
            loading={loading}
            onPress={() => setLoading(true)}
          />

          <View className="mt-4 flex-row justify-center">
            <Badge icon={ShieldCheck} label={`@${env.allowedDomain} accounts only`} />
          </View>

          <View className="my-6 h-px bg-border" />

          <View className="flex-row justify-center">
            <Button
              variant="ghost"
              size="sm"
              label="Preview the dashboard"
              leftIcon={LayoutDashboard}
              onPress={() => router.push('/dashboard')}
            />
          </View>
        </GlassCard>
      </View>

      <Caption className="mt-12 text-center">
        Placeholder build · sign-in isn&apos;t connected yet
      </Caption>
    </Screen>
  );
}
