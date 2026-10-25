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

const PROFILE_COLUMNS = 'id, email, full_name, avatar_url, role, created_at, last_sign_in_at';

export const PROFILE_MESSAGES = {
  failed: "We couldn't load your account. Check your connection and try signing in again.",
  missing: "Your account isn't set up yet. Please contact an administrator.",
} as const;

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
  if (error) throw error;
  return data ? toProfile(data) : null;
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
