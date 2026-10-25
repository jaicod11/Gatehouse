import { Link } from 'expo-router';
import Head from 'expo-router/head';
import {
  Activity,
  ArrowRight,
  LogOut,
  MailPlus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Badge,
  Body,
  Button,
  Caption,
  GlassCard,
  GradientBackground,
  Heading,
  Screen,
  Text,
  type BadgeTone,
  type IconComponent,
} from '@/components/ui';
import { env } from '@/config/env';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

// Placeholder metrics so the layout can be checked before real data exists.
type Stat = { label: string; value: string; note: string; tone: BadgeTone; icon: IconComponent };

const STATS: Stat[] = [
  { label: 'Team members', value: '48', note: '+3 this week', tone: 'success', icon: Users },
  { label: 'Active sessions', value: '17', note: 'Live', tone: 'accent', icon: Activity },
  { label: 'Pending invites', value: '5', note: '2 expiring', tone: 'warning', icon: MailPlus },
  { label: 'Blocked sign-ins', value: '0', note: 'Last 24h', tone: 'neutral', icon: ShieldAlert },
];

const SWATCHES: { name: string; value: string }[] = [
  { name: 'background', value: colors.background },
  { name: 'surface', value: colors.surface },
  { name: 'elevated', value: colors.surfaceElevated },
  { name: 'indigo', value: colors.accent.indigo },
  { name: 'violet', value: colors.accent.violet },
  { name: 'cyan', value: colors.accent.cyan },
  { name: 'success', value: colors.success },
  { name: 'warning', value: colors.warning },
  { name: 'error', value: colors.error },
];

export default function DashboardScreen() {
  const { user, role, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Null only for the moment between signing out and the guard leaving this screen.
  if (!user) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // The route guard sends the user to /login once the session is gone.
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen background={<GradientBackground />} scroll className="px-4 py-6 md:px-8 md:py-10">
      <Head>
        <title>Dashboard · Gatehouse</title>
      </Head>

      <View className="w-full max-w-[1120px] gap-6 self-center md:gap-8">
        <View className="gap-5 md:flex-row md:items-center md:justify-between">
          <View className="flex-row items-center gap-4 md:flex-1">
            <Avatar size="lg" uri={user.avatarUrl} name={user.fullName ?? user.email} ring />
            <View className="flex-1 gap-1">
              <Caption variant="overline">Welcome back</Caption>
              <Heading level={2}>{user.fullName ?? user.email}</Heading>
              <View className="flex-row flex-wrap items-center gap-2">
                <Body size="sm" tone="secondary">
                  {user.email}
                </Body>
                <Badge
                  tone={role === 'admin' ? 'accent' : 'neutral'}
                  dot
                  label={role === 'admin' ? 'Admin' : 'User'}
                />
              </View>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-3">
            {role === 'admin' ? (
              <Link href="/admin" asChild>
                <Button variant="secondary" size="sm" label="Admin" leftIcon={ShieldCheck} />
              </Link>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              label={signingOut ? 'Signing out…' : 'Sign out'}
              leftIcon={LogOut}
              loading={signingOut}
              onPress={handleSignOut}
            />
          </View>
        </View>

        <View className="flex-row flex-wrap gap-4">
          {STATS.map(({ label, value, note, tone, icon: Icon }) => (
            <GlassCard key={label} className="min-w-[240px] flex-1" padding="sm">
              <View className="flex-row items-center justify-between">
                <View className="size-10 items-center justify-center rounded-md border border-border bg-white/[0.04]">
                  <Icon size={18} color={colors.text.secondary} strokeWidth={2} />
                </View>
                <Badge tone={tone} label={note} />
              </View>
              <Text weight="bold" className="mt-5 text-3xl leading-9 tracking-[-0.5px]">
                {value}
              </Text>
              <Body size="sm" tone="secondary" className="mt-1">
                {label}
              </Body>
            </GlassCard>
          ))}
        </View>

        <GlassCard padding="lg">
          <View className="gap-1">
            <Caption variant="overline">Design system</Caption>
            <Heading level={3}>Component preview</Heading>
          </View>

          {/* Two columns on wide screens, one on phones. */}
          <View className="mt-8 gap-10 lg:flex-row">
            <View className="gap-10 lg:flex-1">
              <Section title="Buttons">
                <Row>
                  <Button label="Primary" leftIcon={Sparkles} />
                  <Button variant="secondary" label="Secondary" />
                  <Button variant="ghost" label="Ghost" leftIcon={ArrowRight} />
                </Row>
                <Row>
                  <Button size="sm" label="Small" />
                  <Button size="md" label="Medium" />
                  <Button size="lg" label="Large" leftIcon={Plus} />
                </Row>
                <Row>
                  <Button label="Saving" loading />
                  <Button variant="secondary" label="Loading" loading />
                  <Button label="Disabled" disabled />
                  <Button variant="secondary" label="Disabled" disabled />
                </Row>
              </Section>

              <Section title="Badges">
                <Row>
                  <Badge label="Member" />
                  <Badge tone="accent" dot label="Admin" />
                  <Badge tone="success" dot label="Active" />
                  <Badge tone="warning" label="Invited" />
                  <Badge tone="error" icon={ShieldAlert} label="Blocked" />
                </Row>
              </Section>

              <Section title="Avatars">
                <Row>
                  <Avatar size="lg" name="Alex Rivera" />
                  <Avatar size="md" name={`sam.okafor@${env.allowedDomain}`} />
                  <Avatar size="sm" />
                </Row>
              </Section>
            </View>

            <View className="gap-10 lg:flex-1">
              <Section title="Typography">
                <Heading level={1}>Heading 1</Heading>
                <Heading level={2}>Heading 2</Heading>
                <Heading level={3}>Heading 3</Heading>
                <Body size="lg">Body large: the quick brown fox jumps over the lazy dog.</Body>
                <Body tone="secondary">Body: secondary copy for descriptions and help text.</Body>
                <Body size="sm" tone="secondary">
                  Body small: metadata and supporting detail.
                </Body>
                <Caption>Caption: timestamps and fine print</Caption>
                <Caption variant="overline">Overline label</Caption>
              </Section>

              <Section title="Color tokens">
                <Row>
                  {SWATCHES.map(({ name, value }) => (
                    <View key={name} className="w-16 items-center gap-2">
                      <View
                        className="size-12 rounded-lg border border-border-strong"
                        style={{ backgroundColor: value }}
                      />
                      <Caption>{name}</Caption>
                    </View>
                  ))}
                </Row>
              </Section>
            </View>
          </View>
        </GlassCard>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-4">
      <Text weight="semibold" tone="secondary" className="text-sm leading-5">
        {title}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap items-center gap-3">{children}</View>;
}
