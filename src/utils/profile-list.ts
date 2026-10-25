import type { Profile } from '@/lib/profiles';

export type RoleCounts = { total: number; admins: number; users: number };

export function countRoles(profiles: readonly Profile[]): RoleCounts {
  const admins = profiles.filter((profile) => profile.role === 'admin').length;
  return { total: profiles.length, admins, users: profiles.length - admins };
}

/** Profiles whose name or email contains `query`, ignoring case and surrounding spaces. */
export function filterProfiles(profiles: readonly Profile[], query: string): Profile[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...profiles];
  return profiles.filter(
    (profile) =>
      profile.email.toLowerCase().includes(needle) ||
      (profile.fullName?.toLowerCase().includes(needle) ?? false),
  );
}
