import { Link } from 'expo-router';
import Head from 'expo-router/head';
import {
  ArrowLeft,
  CircleAlert,
  RefreshCw,
  SearchX,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { SummaryTiles } from '@/components/admin/summary-tiles';
import { UserListHeader, UserRow, UserRowSkeleton } from '@/components/admin/user-list';
import { PageFooter } from '@/components/page-footer';
import {
  Appear,
  Badge,
  Body,
  Button,
  Caption,
  ConfirmDialog,
  EmptyState,
  GlassCard,
  GradientBackground,
  Heading,
  Screen,
  SearchField,
  useToast,
} from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { useNow } from '@/hooks/use-now';
import { useProfileList } from '@/hooks/use-profile-list';
import {
  PROFILE_MESSAGES,
  ProfilesError,
  setUserRole,
  type Profile,
  type UserRole,
} from '@/lib/profiles';
import { countRoles, filterProfiles } from '@/utils/profile-list';

type RoleChange = { profile: Profile; role: UserRole };

const SKELETON_ROWS = 4;

function displayName(profile: Profile): string {
  return profile.fullName ?? profile.email;
}

// Only admins get here: the (app) layout guards this route by role, and RLS only returns every
// profile to admins anyway.
export default function AdminScreen() {
  const { profile: me } = useAuth();
  const { state, retry, refresh } = useProfileList();
  const toast = useToast();
  const now = useNow(60_000);

  const [query, setQuery] = useState('');
  // Kept after the dialog closes so its text doesn't vanish during the fade-out.
  const [change, setChange] = useState<RoleChange | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const profiles = state.status === 'ready' ? state.profiles : [];
  const visible = filterProfiles(profiles, query);

  const askToChangeRole = (profile: Profile, role: UserRole) => {
    setChange({ profile, role });
    setDialogOpen(true);
  };

  const confirmChange = async () => {
    if (!change) return;
    const { profile, role } = change;
    setDialogOpen(false);
    setBusyId(profile.id);
    try {
      await setUserRole(profile.id, role);
      toast.show({
        tone: 'success',
        title: 'Role updated',
        message: `${displayName(profile)} is now ${role === 'admin' ? 'an admin' : 'a user'}.`,
      });
      await refresh();
    } catch (error) {
      toast.show({
        tone: 'error',
        title: "Couldn't change the role",
        message: error instanceof ProfilesError ? error.message : PROFILE_MESSAGES.roleFailed,
      });
    } finally {
      setBusyId(null);
    }
  };

  let list;
  if (state.status === 'loading') {
    list = (
      <View
        aria-busy
        aria-label="Loading users"
        className="gap-3 px-4 pb-4 lg:gap-0 lg:px-0 lg:pb-0"
      >
        <UserListHeader />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <UserRowSkeleton key={index} />
        ))}
      </View>
    );
  } else if (state.status === 'error') {
    list = (
      <EmptyState
        tone="error"
        icon={CircleAlert}
        title="Couldn't load users"
        message={state.message}
        action={
          <Button
            variant="secondary"
            size="sm"
            label="Retry"
            leftIcon={RefreshCw}
            onPress={retry}
          />
        }
      />
    );
  } else if (profiles.length === 0) {
    list = (
      <EmptyState
        icon={Users}
        title="No users yet"
        message="People appear here after they sign in for the first time."
      />
    );
  } else if (visible.length === 0) {
    list = (
      <EmptyState
        icon={SearchX}
        title={`No users match “${query.trim()}”`}
        message="Try a different name or email."
        action={
          <Button
            variant="secondary"
            size="sm"
            label="Show everyone"
            onPress={() => setQuery('')}
          />
        }
      />
    );
  } else {
    list = (
      <View className="gap-3 px-4 pb-4 lg:gap-0 lg:px-0 lg:pb-0">
        <UserListHeader />
        {visible.map((profile, index) => (
          <Appear key={profile.id} index={index}>
            <UserRow
              profile={profile}
              isSelf={profile.id === me?.id}
              busy={busyId === profile.id}
              disabled={busyId !== null && busyId !== profile.id}
              now={now}
              onChangeRole={askToChangeRole}
            />
          </Appear>
        ))}
      </View>
    );
  }

  const promoting = change?.role === 'admin';

  return (
    <Screen background={<GradientBackground />} scroll className="px-4 py-6 md:px-8 md:py-10">
      <Head>
        <title>Admin panel · Gatehouse</title>
      </Head>

      <View className="w-full max-w-[1120px] gap-6 self-center md:gap-8">
        <Appear index={0}>
          <View className="items-start gap-4">
            <Link href="/dashboard" asChild>
              <Button variant="ghost" size="sm" label="Dashboard" leftIcon={ArrowLeft} />
            </Link>
            <View className="gap-2">
              <Badge tone="accent" icon={ShieldCheck} label="Admins only" />
              <Heading level={1} className="mt-2">
                Admin panel
              </Heading>
              <Body tone="secondary" className="max-w-[560px]">
                Everyone who has signed in to Gatehouse. Make someone an admin to let them manage
                roles too.
              </Body>
            </View>
          </View>
        </Appear>

        <SummaryTiles
          counts={state.status === 'ready' ? countRoles(profiles) : null}
          loading={state.status === 'loading'}
          startIndex={1}
        />

        <Appear index={4}>
          <GlassCard padding="none">
            <View className="gap-3 p-4 md:flex-row md:items-center md:justify-between md:p-5">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or email"
                className="md:max-w-[360px] md:flex-1"
              />
              {state.status === 'ready' && profiles.length > 0 ? (
                <Caption>
                  {visible.length === profiles.length
                    ? `${profiles.length} ${profiles.length === 1 ? 'person' : 'people'}`
                    : `${visible.length} of ${profiles.length}`}
                </Caption>
              ) : null}
            </View>
            {list}
          </GlassCard>
        </Appear>

        <PageFooter className="mt-2" />
      </View>

      <ConfirmDialog
        visible={dialogOpen}
        icon={promoting ? ShieldPlus : ShieldMinus}
        title={
          change ? `Make ${displayName(change.profile)} ${promoting ? 'an admin' : 'a user'}?` : ''
        }
        message={
          promoting
            ? 'They’ll see every user here and can change other people’s roles.'
            : 'They’ll lose access to the admin panel. You can make them an admin again later.'
        }
        confirmLabel={promoting ? 'Make admin' : 'Make user'}
        onConfirm={confirmChange}
        onCancel={() => setDialogOpen(false)}
      />
    </Screen>
  );
}
