import { Link } from 'expo-router';
import Head from 'expo-router/head';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCog,
  UserRound,
} from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { AccessChecklist, type AccessCheck } from '@/components/dashboard/access-checklist';
import { DetailList } from '@/components/dashboard/detail-list';
import { PageFooter } from '@/components/page-footer';
import {
  Appear,
  Avatar,
  Badge,
  Body,
  Button,
  Caption,
  CardHeader,
  GlassCard,
  GradientBackground,
  Heading,
  Screen,
} from '@/components/ui';
import { env } from '@/config/env';
import { useAuth } from '@/context/auth-context';
import { useNow } from '@/hooks/use-now';
import type { UserRole } from '@/lib/profiles';
import { formatDate, formatRelativeTime } from '@/utils/format-date';

const PLATFORM_LABELS: Record<string, string> = { web: 'Web', ios: 'iOS', android: 'Android' };
const PROVIDER_LABELS: Record<string, string> = { google: 'Google' };

function roleLabel(role: UserRole): string {
  return role === 'admin' ? 'Admin' : 'User';
}

export default function DashboardScreen() {
  const { session, profile, signOut } = useAuth();
  const now = useNow();
  const [signingOut, setSigningOut] = useState(false);

  // Null only for the moment between signing out and the guard leaving this screen.
  if (!session || !profile) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // The route guard sends the user to /login once the session is gone.
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const isAdmin = profile.role === 'admin';
  const name = profile.fullName ?? profile.email;
  const providerId = String(session.user.app_metadata?.provider ?? '');
  const provider = PROVIDER_LABELS[providerId] ?? (providerId || 'Unknown');
  const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
  const tokenStatus =
    expiresAt === null
      ? 'Unknown'
      : expiresAt <= now
        ? 'Refreshing now'
        : `Refreshes ${formatRelativeTime(expiresAt, now)}`;

  const checks: AccessCheck[] = [
    { title: `Signed in with ${provider}`, detail: 'OAuth 2.0 + PKCE, through Supabase Auth' },
    { title: 'Email domain verified', detail: `@${env.allowedDomain}` },
    {
      title: 'Server-side domain check passed',
      detail: 'Your account exists, so the sign-up hook allowed its domain',
    },
    {
      title: 'Data protected by row-level security',
      detail: isAdmin
        ? 'Admins can read every profile; nobody can edit roles directly'
        : 'You can read only your own profile',
    },
    {
      title: `Role: ${roleLabel(profile.role)}`,
      detail: isAdmin ? 'You can manage other users’ roles' : 'Standard access',
    },
  ];

  return (
    <Screen background={<GradientBackground />} scroll className="px-4 py-6 md:px-8 md:py-10">
      <Head>
        <title>Dashboard · Gatehouse</title>
      </Head>

      <View className="w-full max-w-[1120px] gap-6 self-center md:gap-8">
        <Appear index={0}>
          <View className="gap-5 md:flex-row md:items-center md:justify-between">
            <View className="flex-row items-center gap-4 md:flex-1">
              <Avatar size="lg" uri={profile.avatarUrl} name={name} ring />
              <View className="flex-1 gap-1">
                <Caption variant="overline">Welcome back</Caption>
                <Heading level={2} numberOfLines={2}>
                  {name}
                </Heading>
                <View className="flex-row flex-wrap items-center gap-2">
                  {/* Truncated here; the account card shows the full address. */}
                  <Body size="sm" tone="secondary" numberOfLines={1} className="min-w-0 shrink">
                    {profile.email}
                  </Body>
                  <Badge
                    tone={isAdmin ? 'accent' : 'neutral'}
                    dot
                    label={roleLabel(profile.role)}
                  />
                </View>
              </View>
            </View>
            <Button
              variant="secondary"
              size="sm"
              label={signingOut ? 'Signing out…' : 'Sign out'}
              leftIcon={LogOut}
              loading={signingOut}
              onPress={handleSignOut}
            />
          </View>
        </Appear>

        <View className="gap-6 md:flex-row md:items-start">
          <View className="gap-6 md:flex-1">
            <Appear index={1}>
              <GlassCard>
                <CardHeader
                  icon={UserRound}
                  title="Your account"
                  subtitle="Your Gatehouse profile"
                />
                <View className="mt-4">
                  <DetailList
                    items={[
                      { icon: UserRound, label: 'Name', value: profile.fullName ?? 'Not set' },
                      { icon: Mail, label: 'Email', value: profile.email },
                      {
                        icon: ShieldCheck,
                        label: 'Role',
                        value: (
                          <Badge
                            tone={isAdmin ? 'accent' : 'neutral'}
                            dot
                            label={roleLabel(profile.role)}
                          />
                        ),
                      },
                      {
                        icon: CalendarDays,
                        label: 'Member since',
                        value: formatDate(profile.createdAt) ?? 'Unknown',
                      },
                      {
                        icon: Clock,
                        label: 'Last sign-in',
                        value: formatRelativeTime(profile.lastSignInAt, now) ?? 'Not recorded',
                      },
                    ]}
                  />
                </View>
              </GlassCard>
            </Appear>

            <Appear index={2}>
              <GlassCard>
                <CardHeader icon={KeyRound} title="Session" subtitle="This device" />
                <View className="mt-4">
                  <DetailList
                    items={[
                      { icon: LogIn, label: 'Provider', value: provider },
                      { icon: Smartphone, label: 'Status', value: 'Signed in on this device' },
                      { icon: RefreshCw, label: 'Access token', value: tokenStatus },
                      {
                        icon: Monitor,
                        label: 'Platform',
                        value: PLATFORM_LABELS[Platform.OS] ?? Platform.OS,
                      },
                    ]}
                  />
                </View>
              </GlassCard>
            </Appear>
          </View>

          <View className="gap-6 md:flex-1">
            <Appear index={3}>
              <GlassCard>
                <CardHeader
                  icon={ShieldCheck}
                  title="Access checks"
                  subtitle="How you got in"
                  accessory={<Badge tone="success" dot label="All passed" />}
                />
                <View className="mt-5">
                  <AccessChecklist checks={checks} />
                </View>
              </GlassCard>
            </Appear>

            {isAdmin ? (
              <Appear index={4}>
                <GlassCard>
                  <CardHeader icon={UserCog} title="Admin panel" subtitle="Admins only" />
                  <Body size="sm" tone="secondary" className="mt-4">
                    See everyone who has signed in to Gatehouse and decide who else gets admin
                    access.
                  </Body>
                  <View className="mt-5 flex-row">
                    <Link href="/admin" asChild>
                      <Button size="sm" label="Open admin panel" leftIcon={ArrowRight} />
                    </Link>
                  </View>
                </GlassCard>
              </Appear>
            ) : null}
          </View>
        </View>

        <PageFooter className="mt-2" />
      </View>
    </Screen>
  );
}
