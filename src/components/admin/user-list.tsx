import { ShieldMinus, ShieldPlus } from 'lucide-react-native';
import { View } from 'react-native';

import { Avatar, Badge, Body, Button, Caption, Skeleton, Text } from '@/components/ui';
import type { Profile, UserRole } from '@/lib/profiles';
import { formatDate, formatRelativeTime } from '@/utils/format-date';

// Below lg each row is a card; from lg up the rows form a table with these column widths. The role
// badge sits at the end of the user block, so on phones it shares the name's line, and on desktop
// it still lines up under the Role column (the user block grows with flex-1 and gaps match).
const COLUMNS = {
  role: 'shrink-0 lg:w-24',
  joined: 'flex-1 lg:w-32 lg:flex-none',
  lastSignIn: 'flex-1 lg:w-36 lg:flex-none',
  action: 'lg:w-52 lg:items-end',
} as const;

const ROW =
  'gap-4 rounded-xl border border-border bg-white/[0.03] p-4 ' +
  'lg:flex-row lg:items-center lg:gap-4 lg:rounded-none lg:border-0 lg:border-t lg:bg-transparent lg:px-5 lg:py-3.5';

/** Column titles, shown only in the table layout. */
export function UserListHeader() {
  return (
    <View className="hidden lg:flex lg:flex-row lg:items-center lg:gap-4 lg:border-t lg:border-border lg:px-5 lg:py-2.5">
      <Caption variant="overline" className="flex-1">
        User
      </Caption>
      <Caption variant="overline" className={COLUMNS.role}>
        Role
      </Caption>
      <Caption variant="overline" className={COLUMNS.joined}>
        Joined
      </Caption>
      <Caption variant="overline" className={COLUMNS.lastSignIn}>
        Last sign-in
      </Caption>
      <Caption variant="overline" className="lg:w-52 lg:text-right">
        Access
      </Caption>
    </View>
  );
}

export type UserRowProps = {
  profile: Profile;
  /** The signed-in admin's own row: the action is disabled with an explanation. */
  isSelf: boolean;
  /** This row's role change is in progress. */
  busy: boolean;
  /** Another row's change is in progress. */
  disabled: boolean;
  now: number;
  onChangeRole: (profile: Profile, role: UserRole) => void;
};

export function UserRow({ profile, isSelf, busy, disabled, now, onChangeRole }: UserRowProps) {
  const name = profile.fullName ?? profile.email;
  const isAdmin = profile.role === 'admin';
  const nextRole: UserRole = isAdmin ? 'user' : 'admin';

  return (
    <View testID={`user-row-${profile.id}`} className={ROW}>
      <View className="flex-row items-center gap-3 lg:min-w-0 lg:flex-1 lg:gap-4">
        <Avatar size="md" uri={profile.avatarUrl} name={name} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text weight="semibold" numberOfLines={1} className="shrink text-sm leading-5">
              {name}
            </Text>
            {isSelf ? <Badge label="You" /> : null}
          </View>
          {/* Without a name, the email is already the title line. */}
          {profile.fullName ? (
            <Body size="sm" tone="secondary" numberOfLines={1}>
              {profile.email}
            </Body>
          ) : null}
        </View>
        <View className={COLUMNS.role}>
          <Badge tone={isAdmin ? 'accent' : 'neutral'} dot label={isAdmin ? 'Admin' : 'User'} />
        </View>
      </View>

      <View className="flex-row gap-4">
        <View className={COLUMNS.joined}>
          <Caption className="lg:hidden">Joined</Caption>
          <Body size="sm">{formatDate(profile.createdAt) ?? 'Unknown'}</Body>
        </View>
        <View className={COLUMNS.lastSignIn}>
          <Caption className="lg:hidden">Last sign-in</Caption>
          <Body size="sm">{formatRelativeTime(profile.lastSignInAt, now) ?? 'Never'}</Body>
        </View>
      </View>

      <View className={`gap-1.5 ${COLUMNS.action}`}>
        <Button
          variant="secondary"
          size="sm"
          label={nextRole === 'admin' ? 'Make admin' : 'Make user'}
          leftIcon={nextRole === 'admin' ? ShieldPlus : ShieldMinus}
          loading={busy}
          disabled={isSelf || disabled}
          aria-label={
            isSelf
              ? "You can't change your own role"
              : `${nextRole === 'admin' ? 'Make admin' : 'Make user'}: ${name}`
          }
          onPress={() => onChangeRole(profile, nextRole)}
        />
        {isSelf ? (
          <Caption className="lg:text-right">You can&apos;t change your own role</Caption>
        ) : null}
      </View>
    </View>
  );
}

/** Placeholder row with the same layout, shown while the list loads. */
export function UserRowSkeleton() {
  return (
    <View aria-hidden className={ROW}>
      <View className="flex-row items-center gap-3 lg:flex-1 lg:gap-4">
        <Skeleton width={40} height={40} radius={20} />
        <View className="flex-1 gap-2">
          <Skeleton width="45%" height={12} />
          <Skeleton width="70%" height={10} />
        </View>
        <View className={COLUMNS.role}>
          <Skeleton width={56} height={22} radius={11} />
        </View>
      </View>
      <View className="flex-row gap-4">
        <View className={COLUMNS.joined}>
          <Skeleton width={84} height={12} />
        </View>
        <View className={COLUMNS.lastSignIn}>
          <Skeleton width={72} height={12} />
        </View>
      </View>
      <View className={COLUMNS.action}>
        <Skeleton width={112} height={36} radius={12} />
      </View>
    </View>
  );
}
