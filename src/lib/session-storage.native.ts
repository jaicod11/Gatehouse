import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage for iOS and Android: everything lives in SecureStore, which the OS
 * encrypts (Keychain on iOS, Keystore-backed encryption on Android). No custom crypto.
 *
 * A session can be larger than one SecureStore entry should hold, so each value is split into
 * chunks: `<key>.0`, `<key>.1`, ... plus a `<key>.n` entry with the chunk count.
 */

/**
 * Max UTF-8 bytes per SecureStore entry. Expo doesn't enforce a limit, but some iOS versions
 * rejected values over 2048 bytes, so stay well under it.
 */
export const CHUNK_BYTES = 1800;

/** Upper bound on chunks per value (about 180KB), so a corrupt count can't loop for long. */
const MAX_CHUNKS = 100;

const SAFE_CHAR = /[A-Za-z0-9._-]/;

/**
 * SecureStore keys may contain only letters, digits, ".", "-" and "_". Other characters become
 * `_<hex code point>_`. Supabase's keys (`sb-<project>-auth-token...`) are already valid.
 */
export function toSecureStoreKey(key: string): string {
  return Array.from(key, (char) =>
    SAFE_CHAR.test(char) ? char : `_${char.codePointAt(0)!.toString(16)}_`,
  ).join('');
}

function utf8Bytes(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Splits a string into chunks of at most `maxBytes` UTF-8 bytes, never inside a character. */
export function splitIntoChunks(value: string, maxBytes = CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let start = 0;
  let position = 0;
  let bytes = 0;
  for (const char of value) {
    const size = utf8Bytes(char.codePointAt(0)!);
    if (bytes + size > maxBytes) {
      chunks.push(value.slice(start, position));
      start = position;
      bytes = 0;
    }
    bytes += size;
    position += char.length;
  }
  if (position > start) chunks.push(value.slice(start));
  return chunks;
}

const countKey = (safeKey: string) => `${safeKey}.n`;
const chunkKey = (safeKey: string, index: number) => `${safeKey}.${index}`;

/** The stored chunk count, or null if it's missing, unreadable or malformed. */
async function readCount(safeKey: string): Promise<number | null> {
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(countKey(safeKey));
  } catch {
    return null;
  }
  if (raw === null) return null;
  const count = Number(raw);
  return Number.isInteger(count) && count >= 0 && count <= MAX_CHUNKS ? count : null;
}

/** Deletes chunks from `from` up: all below `knownCount`, then any further ones that exist. */
async function deleteChunks(safeKey: string, from: number, knownCount: number): Promise<void> {
  for (let index = from; index < MAX_CHUNKS; index++) {
    if (index >= knownCount) {
      const exists = await SecureStore.getItemAsync(chunkKey(safeKey, index)).then(
        (value) => value !== null,
        () => true, // Unreadable but present: delete it anyway.
      );
      if (!exists) return;
    }
    await SecureStore.deleteItemAsync(chunkKey(safeKey, index));
  }
}

// Earlier versions kept an AES key in SecureStore and the encrypted session in AsyncStorage, both
// under the plain key name. Remove those once per key per app run; affected users sign in again.
const legacyChecked = new Set<string>();

async function removeLegacyEntries(key: string): Promise<void> {
  if (legacyChecked.has(key)) return;
  legacyChecked.add(key);
  try {
    const [ciphertext, aesKey] = await Promise.all([
      AsyncStorage.getItem(key),
      SecureStore.getItemAsync(key).catch(() => 'unreadable'),
    ]);
    if (ciphertext !== null) await AsyncStorage.removeItem(key);
    if (aesKey !== null) await SecureStore.deleteItemAsync(key);
  } catch {
    // Best effort: the old entries are never read, so leftovers are harmless.
  }
}

// Operations on the same key run one at a time, so a read never sees a half-finished write.
const queues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const result = (queues.get(key) ?? Promise.resolve()).then(task, task);
  queues.set(
    key,
    result.catch(() => undefined),
  );
  return result;
}

export const sessionStorageAdapter: SupportedStorage = {
  /** The stored value, or null if it's missing or incomplete. Never throws, never deletes. */
  getItem: (key) =>
    serialized(key, async () => {
      await removeLegacyEntries(key);
      const safeKey = toSecureStoreKey(key);
      const count = await readCount(safeKey);
      if (count === null) return null;
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.getItemAsync(chunkKey(safeKey, index)).catch(() => null),
        ),
      );
      return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
    }),

  setItem: (key, value) =>
    serialized(key, async () => {
      await removeLegacyEntries(key);
      const safeKey = toSecureStoreKey(key);
      const chunks = splitIntoChunks(value);
      const previousCount = (await readCount(safeKey)) ?? 0;
      // Remove the count first: until the new one is written, readers see "no value" rather than
      // a mix of old and new chunks if this write is interrupted.
      await SecureStore.deleteItemAsync(countKey(safeKey));
      for (const [index, chunk] of chunks.entries()) {
        await SecureStore.setItemAsync(chunkKey(safeKey, index), chunk);
      }
      await SecureStore.setItemAsync(countKey(safeKey), String(chunks.length));
      // Leftovers from a longer previous value.
      await deleteChunks(safeKey, chunks.length, previousCount);
    }),

  removeItem: (key) =>
    serialized(key, async () => {
      await removeLegacyEntries(key);
      const safeKey = toSecureStoreKey(key);
      const previousCount = (await readCount(safeKey)) ?? 0;
      await SecureStore.deleteItemAsync(countKey(safeKey));
      await deleteChunks(safeKey, 0, previousCount);
    }),
};
