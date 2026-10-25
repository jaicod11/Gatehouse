import { supabase } from './supabase';

export type UserRole = 'admin' | 'user';

/** A row of public.profiles (supabase/migrations/*_profiles.sql), in app naming. */
export type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string | null;
  last_sign_in_at: string | null;
};

/** The parts of a PostgREST error the app looks at. */
type QueryError = { code?: string; message: string };

const PROFILE_COLUMNS = 'id, email, full_name, avatar_url, role, created_at, last_sign_in_at';

export const PROFILE_MESSAGES = {
  failed: "We couldn't load your account. Check your connection and try signing in again.",
  missing: "Your account isn't set up yet. Please contact an administrator.",
  listFailed: "We couldn't load the user list. Check your connection and try again.",
  roleForbidden: "You don't have permission to change roles.",
  roleSelf: "You can't change your own role.",
  roleNotFound: 'That user no longer exists. Refresh the list and try again.',
  roleFailed: "The role couldn't be changed. Please try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
} as const;

/** A failed profiles request. `message` is safe to show; the server's own text never is. */
export class ProfilesError extends Error {
  override name = 'ProfilesError';

  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * The signed-in user's profile, or null when there is no row they may read (never created, or
 * hidden by RLS). Throws when the request itself fails.
 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle<ProfileRow>();
  if (error) throw new ProfilesError(PROFILE_MESSAGES.failed, error.code);
  return data ? toProfile(data) : null;
}

/**
 * Every profile the caller may read, oldest first. For admins that's everyone; RLS limits anyone
 * else to their own row.
 */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: true });
  if (error) {
    throw new ProfilesError(
      isNetworkError(error) ? PROFILE_MESSAGES.network : PROFILE_MESSAGES.listFailed,
      error.code,
    );
  }
  return ((data ?? []) as ProfileRow[]).map(toProfile);
}

/**
 * Changes a user's role through the set_user_role RPC, which checks on the server that the caller
 * is an admin and isn't demoting themselves. Returns the updated profile.
 */
export async function setUserRole(userId: string, role: UserRole): Promise<Profile> {
  const { data, error } = await supabase.rpc('set_user_role', { target: userId, new_role: role });
  if (error) throw new ProfilesError(describeRoleError(error), error.code);
  return toProfile(data as ProfileRow);
}

function describeRoleError(error: QueryError): string {
  // Codes raised by set_user_role (supabase/migrations/*_profiles_access.sql).
  if (error.code === '42501') {
    return /own admin role/i.test(error.message)
      ? PROFILE_MESSAGES.roleSelf
      : PROFILE_MESSAGES.roleForbidden;
  }
  if (error.code === 'P0002') return PROFILE_MESSAGES.roleNotFound;
  if (isNetworkError(error)) return PROFILE_MESSAGES.network;
  return PROFILE_MESSAGES.roleFailed;
}

// postgrest-js reports a failed fetch as an error with an empty code and the fetch error's text.
function isNetworkError(error: QueryError): boolean {
  return !error.code && /network|fetch|load failed/i.test(error.message);
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    // The database only allows 'admin' and 'user'; anything else gets the lesser role.
    role: row.role === 'admin' ? 'admin' : 'user',
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  };
}
