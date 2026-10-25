import { ACCESS_DENIED_MESSAGE, isAllowedEmail } from '@/utils/domain';

// isAllowedEmail takes the domain as an argument, so any fixture domain works here.
const DOMAIN = 'example.com';

describe('isAllowedEmail', () => {
  it.each([`user@${DOMAIN}`, `USER@${DOMAIN.toUpperCase()}`, `  user@${DOMAIN}  `])(
    'allows %j',
    (email) => {
      expect(isAllowedEmail(email, DOMAIN)).toBe(true);
    },
  );

  it('compares against the allowed domain case-insensitively', () => {
    expect(isAllowedEmail(`user@${DOMAIN}`, DOMAIN.toUpperCase())).toBe(true);
  });

  it.each([
    'user@gmail.com',
    `user@x${DOMAIN}`,
    `user@${DOMAIN}.evil.com`,
    `user@mail.${DOMAIN}`,
    `user@evil.com@${DOMAIN}`,
    `@${DOMAIN}`,
    'user@',
    `user ${DOMAIN}`,
    `us er@${DOMAIN}`,
    DOMAIN,
    '',
    null,
    undefined,
  ])('rejects %j', (email) => {
    expect(isAllowedEmail(email, DOMAIN)).toBe(false);
  });

  it('rejects everything when the allowed domain is empty', () => {
    expect(isAllowedEmail('user@', '')).toBe(false);
    expect(isAllowedEmail(`user@${DOMAIN}`, '  ')).toBe(false);
  });
});

describe('ACCESS_DENIED_MESSAGE', () => {
  it('is the exact text the assignment requires', () => {
    expect(ACCESS_DENIED_MESSAGE).toBe(
      'Access restricted. Please login using your official domain email.',
    );
  });
});
