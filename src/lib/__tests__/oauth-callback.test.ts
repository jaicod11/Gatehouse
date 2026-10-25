import { AuthRetryableFetchError } from '@supabase/supabase-js';

import {
  DOMAIN_NOT_ALLOWED_MARKER,
  SIGN_IN_MESSAGES,
  describeOAuthError,
  describeSignInError,
  parseOAuthCallback,
} from '@/lib/oauth-callback';
import { ACCESS_DENIED_MESSAGE } from '@/utils/domain';

/** The message our Before User Created hook returns (supabase/migrations). */
const HOOK_MESSAGE = "DOMAIN_NOT_ALLOWED: sign-ups are limited to the organisation's email domain.";

describe('parseOAuthCallback', () => {
  it.each([
    'gatehouse://auth/callback?code=abc123',
    'exp://192.168.1.10:8081/--/auth/callback?code=abc123',
    'https://gatehouse.example/auth/callback?code=abc123#',
  ])('reads the code from %s', (url) => {
    expect(parseOAuthCallback(url)).toEqual({
      code: 'abc123',
      error: null,
      errorCode: null,
      errorDescription: null,
    });
  });

  it('reads an error from the query string', () => {
    const url =
      'gatehouse://auth/callback?error=access_denied&error_code=403&error_description=User+denied';
    expect(parseOAuthCallback(url)).toEqual({
      code: null,
      error: 'access_denied',
      errorCode: '403',
      errorDescription: 'User denied',
    });
  });

  it('reads an error from the fragment', () => {
    const url = 'https://gatehouse.example/auth/callback#error=server_error&error_code=500';
    expect(parseOAuthCallback(url)).toMatchObject({ error: 'server_error', errorCode: '500' });
  });

  it('treats a lone error_description as an error', () => {
    const url = 'https://gatehouse.example/auth/callback?error_description=Something+broke';
    expect(parseOAuthCallback(url).error).toBe('unknown');
  });

  it('returns nothing for a URL without parameters', () => {
    expect(parseOAuthCallback('gatehouse://auth/callback')).toEqual({
      code: null,
      error: null,
      errorCode: null,
      errorDescription: null,
    });
  });
});

describe('describeOAuthError', () => {
  const describeUrl = (url: string) => describeOAuthError(parseOAuthCallback(url));

  it('explains access_denied', () => {
    expect(describeUrl('gatehouse://auth/callback?error=access_denied')).toBe(
      SIGN_IN_MESSAGES.denied,
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(describeUrl('gatehouse://auth/callback?error=server_error')).toBe(
      SIGN_IN_MESSAGES.failed,
    );
  });

  it('never returns the raw error_description', () => {
    const message = describeUrl(
      'https://gatehouse.example/auth/callback?error=server_error&error_description=Call+555-0100',
    );
    expect(message).toBe(SIGN_IN_MESSAGES.failed);
    expect(message).not.toContain('555-0100');
  });

  describe('a rejection by the domain hook', () => {
    const encoded = encodeURIComponent(HOOK_MESSAGE);

    it.each([
      [
        'error_description, query',
        `https://g.example/auth/callback?error=server_error&error_description=${encoded}`,
      ],
      [
        'error_description, fragment',
        `https://g.example/auth/callback#error=server_error&error_description=${encoded}`,
      ],
      [
        'with error=access_denied',
        `gatehouse://auth/callback?error=access_denied&error_description=${encoded}`,
      ],
      ['error_description only', `gatehouse://auth/callback?error_description=${encoded}`],
      [
        'error_code',
        `gatehouse://auth/callback?error=server_error&error_code=${DOMAIN_NOT_ALLOWED_MARKER}`,
      ],
    ])('shows the access-denied message (%s)', (_label, url) => {
      expect(describeUrl(url)).toBe(ACCESS_DENIED_MESSAGE);
    });

    it("doesn't show the hook's own text", () => {
      const url = `https://g.example/auth/callback?error=server_error&error_description=${encoded}`;
      expect(describeUrl(url)).not.toContain('organisation');
    });
  });
});

describe('describeSignInError', () => {
  it.each([
    new AuthRetryableFetchError('Failed to fetch', 0),
    new TypeError('Network request failed'),
    new TypeError('Failed to fetch'),
  ])('reports %p as a network problem', (error) => {
    expect(describeSignInError(error)).toBe(SIGN_IN_MESSAGES.network);
  });

  it('falls back to a generic message', () => {
    expect(describeSignInError(new Error('boom'))).toBe(SIGN_IN_MESSAGES.failed);
  });
});
