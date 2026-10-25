// Runs Node's crypto in place of expo-crypto's native side, so it needs Node's types.
/// <reference types="node" />

import { createHash } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { installCryptoShim, sha256Digest } from '@/lib/crypto-shim.native';

// expo-crypto's native side doesn't exist under Jest; back its two functions with Node's crypto.
jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: jest.fn(async (algorithm: string, data: ArrayBufferView) => {
      if (algorithm !== 'SHA-256') throw new Error(`unexpected algorithm ${algorithm}`);
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const hash = nodeCrypto.createHash('sha256').update(bytes).digest();
      return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
    }),
    getRandomValues: jest.fn((array: Uint8Array) => nodeCrypto.randomFillSync(array)),
  };
});

const hex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString('hex');

describe('sha256Digest', () => {
  it('matches the SHA-256 test vector for "abc"', async () => {
    const result = await sha256Digest('SHA-256', new TextEncoder().encode('abc'));

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(hex(result)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('accepts the algorithm as an object, like WebCrypto', async () => {
    const result = await sha256Digest({ name: 'sha-256' }, new TextEncoder().encode(''));
    expect(hex(result)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('refuses other algorithms', async () => {
    await expect(sha256Digest('SHA-1', new Uint8Array())).rejects.toThrow('only supports SHA-256');
  });
});

describe('installCryptoShim', () => {
  it('adds getRandomValues and subtle.digest where crypto is missing', async () => {
    const target: { crypto?: { getRandomValues?: unknown; subtle?: { digest?: unknown } } } = {};

    expect(installCryptoShim(target)).toEqual(['getRandomValues', 'subtle.digest']);

    expect(typeof target.crypto?.getRandomValues).toBe('function');
    expect(target.crypto?.subtle?.digest).toBe(sha256Digest);
  });

  it('leaves existing implementations alone', () => {
    const getRandomValues = jest.fn();
    const digest = jest.fn();
    const target = { crypto: { getRandomValues, subtle: { digest } } };

    expect(installCryptoShim(target)).toEqual([]);

    expect(target.crypto.getRandomValues).toBe(getRandomValues);
    expect(target.crypto.subtle.digest).toBe(digest);
  });
});

describe('PKCE in supabase-js (the native bug: "plain" instead of S256)', () => {
  const realCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  /** Builds a Google sign-in URL with a real supabase-js client and in-memory storage. */
  async function authorize() {
    const memory = new Map<string, string>();
    const client = createClient('https://project.supabase.co', 'sb_publishable_test', {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
        storage: {
          getItem: async (key) => memory.get(key) ?? null,
          setItem: async (key, value) => void memory.set(key, value),
          removeItem: async (key) => void memory.delete(key),
        },
      },
    });
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'gatehouse://auth/callback', skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error('no url');
    const params = new URL(data.url).searchParams;
    // supabase-js stores values as JSON; the verifier slot holds "<verifier>" or "<verifier>/recovery".
    const stored = [...memory.entries()].find(
      ([key]) => key.endsWith('code-verifier') && !key.includes('-flows-'),
    )?.[1];
    const verifier = stored ? (JSON.parse(stored) as string).split('/')[0] : undefined;
    return {
      method: params.get('code_challenge_method'),
      challenge: params.get('code_challenge'),
      verifier,
    };
  }

  function setGlobalCrypto(value: unknown) {
    Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });
  }

  afterEach(() => {
    if (realCrypto) Object.defineProperty(globalThis, 'crypto', realCrypto);
  });

  it('falls back to "plain" when there is no crypto global, as on Hermes', async () => {
    setGlobalCrypto(undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { method } = await authorize();

    expect(method).toBe('plain');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('WebCrypto API is not supported'));
    warn.mockRestore();
  });

  it('uses S256 once the shim is installed, with a challenge that matches the verifier', async () => {
    setGlobalCrypto(undefined);
    expect(installCryptoShim(globalThis)).toEqual(['getRandomValues', 'subtle.digest']);

    const { method, challenge, verifier } = await authorize();

    expect(method).toBe('s256');
    expect(verifier).toMatch(/^[0-9a-f]{112}$/); // from crypto.getRandomValues, not Math.random
    const expected = createHash('sha256').update(verifier!).digest('base64url');
    expect(challenge).toBe(expected);
  });
});
