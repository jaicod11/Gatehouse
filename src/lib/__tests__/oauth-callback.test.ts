import { AuthRetryableFetchError } from '@supabase/supabase-js';

import {
  SIGN_IN_MESSAGES,
  describeOAuthError,
  describeSignInError,
  parseOAuthCallback,
} from '@/lib/oauth-callback';

describe('parseOAuthCallback', () => {
  it.each([
    'gatehouse://auth/callback?code=abc123',
    'exp://192.168.1.10:8081/--/auth/callback?code=abc123',
    'https://gatehouse.example/auth/callback?code=abc123#',
  ])('reads the code from %s', (url) => {
    expect(parseOAuthCallback(url)).toEqual({ code: 'abc123', error: null });
  });

  it('reads an error from the query string', () => {
    const url = 'gatehouse://auth/callback?error=access_denied&error_description=User+denied';
    expect(parseOAuthCallback(url)).toEqual({ code: null, error: 'access_denied' });
  });

  it('reads an error from the fragment', () => {
    const url = 'https://gatehouse.example/auth/callback#error=server_error&error_code=500';
    expect(parseOAuthCallback(url).error).toBe('server_error');
  });

  it('treats a lone error_description as an error', () => {
    const url = 'https://gatehouse.example/auth/callback?error_description=Something+broke';
    expect(parseOAuthCallback(url).error).toBe('unknown');
  });

  it('returns nothing for a URL without parameters', () => {
    expect(parseOAuthCallback('gatehouse://auth/callback')).toEqual({ code: null, error: null });
  });
});

describe('describeOAuthError', () => {
  it('explains access_denied', () => {
    expect(describeOAuthError('access_denied')).toBe(SIGN_IN_MESSAGES.denied);
  });

  it('falls back to a generic message for anything else', () => {
    expect(describeOAuthError('server_error')).toBe(SIGN_IN_MESSAGES.failed);
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
