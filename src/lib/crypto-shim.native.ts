import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

/**
 * Minimal WebCrypto for Hermes (iOS / Android), which has no `crypto` global. supabase-js needs it
 * for PKCE: without `crypto.getRandomValues` it builds the code verifier with Math.random, and
 * without `crypto.subtle.digest` it falls back to the "plain" challenge method instead of S256.
 * Both are backed by expo-crypto. Only what's missing is added; nothing is overridden.
 */

type DigestAlgorithm = string | { name: string };

/** `crypto.subtle.digest`, limited to SHA-256 (all supabase-js needs). */
export async function sha256Digest(
  algorithm: DigestAlgorithm,
  data: BufferSource,
): Promise<ArrayBuffer> {
  const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
  if (name?.toUpperCase() !== 'SHA-256') {
    throw new Error(`The crypto shim only supports SHA-256, not ${String(name)}.`);
  }
  return digest(CryptoDigestAlgorithm.SHA256, data);
}

type CryptoLike = { getRandomValues?: unknown; subtle?: { digest?: unknown } };

/** Adds the missing pieces to `target.crypto`. Returns the names of what it added. */
export function installCryptoShim(target: object = globalThis): string[] {
  const scope = target as { crypto?: CryptoLike };
  if (typeof scope.crypto !== 'object' || scope.crypto === null) {
    Object.defineProperty(scope, 'crypto', {
      value: {},
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
  const crypto = scope.crypto as CryptoLike;
  const added: string[] = [];

  if (typeof crypto.getRandomValues !== 'function') {
    crypto.getRandomValues = getRandomValues;
    added.push('getRandomValues');
  }
  if (typeof crypto.subtle !== 'object' || crypto.subtle === null) {
    crypto.subtle = {};
  }
  if (typeof crypto.subtle.digest !== 'function') {
    crypto.subtle.digest = sha256Digest;
    added.push('subtle.digest');
  }
  return added;
}

installCryptoShim();
