import type { Profile } from '@/lib/profiles';
import { countRoles, filterProfiles } from '@/utils/profile-list';

function profile(id: string, fullName: string | null, email: string, role: Profile['role']) {
  return { id, fullName, email, role, avatarUrl: null, createdAt: null, lastSignInAt: null };
}

const PROFILES: Profile[] = [
  profile('1', 'Ada Lovelace', 'ada@example.com', 'admin'),
  profile('2', 'Alan Turing', 'alan@example.com', 'user'),
  profile('3', null, 'grace@example.com', 'user'),
];

describe('countRoles', () => {
  it('counts everyone, admins and users', () => {
    expect(countRoles(PROFILES)).toEqual({ total: 3, admins: 1, users: 2 });
    expect(countRoles([])).toEqual({ total: 0, admins: 0, users: 0 });
  });
});

describe('filterProfiles', () => {
  const ids = (query: string) => filterProfiles(PROFILES, query).map((p) => p.id);

  it('matches the name or the email, ignoring case and surrounding spaces', () => {
    expect(ids('lovelace')).toEqual(['1']);
    expect(ids('  ALAN ')).toEqual(['2']);
    expect(ids('grace@')).toEqual(['3']);
    expect(ids('example.com')).toEqual(['1', '2', '3']);
  });

  it('returns everyone for an empty query', () => {
    expect(ids('')).toEqual(['1', '2', '3']);
    expect(ids('   ')).toEqual(['1', '2', '3']);
  });

  it('returns nothing when nobody matches', () => {
    expect(ids('zzz')).toEqual([]);
  });
});
