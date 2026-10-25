import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  CHUNK_BYTES,
  sessionStorageAdapter as storage,
  splitIntoChunks,
  toSecureStoreKey,
} from '@/lib/session-storage.native';

// SecureStore's native side doesn't exist under Jest. This in-memory version applies the real
// module's key rule, and rejects values over 2048 bytes like older iOS versions did. It lives
// outside the factory so that it survives a module reload (an "app restart").
const mockSecureStore = new Map<string, string>();
const mockFailures = { readKeys: new Set<string>(), writeKeys: new Set<string>() };

jest.mock('expo-secure-store', () => {
  const check = (key: string) => {
    if (!/^[\w.-]+$/.test(key)) throw new Error(`Invalid key provided to SecureStore: ${key}`);
  };
  return {
    getItemAsync: jest.fn(async (key: string) => {
      check(key);
      if (mockFailures.readKeys.has(key)) throw new Error('Could not decrypt the item');
      return mockSecureStore.get(key) ?? null;
    }),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      check(key);
      if (mockFailures.writeKeys.has(key)) throw new Error('Write failed');
      if (new TextEncoder().encode(value).length > 2048) throw new Error('Value too large');
      mockSecureStore.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      check(key);
      mockSecureStore.delete(key);
    }),
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const KEY = 'sb-project-auth-token';

/** A session-like JSON string of roughly `size` characters, with some non-ASCII text in it. */
function bigValue(size: number): string {
  const filler = 'é漢🙂abcdefghij'.repeat(Math.ceil(size / 14));
  return JSON.stringify({ access_token: 'x'.repeat(800), user: { name: filler.slice(0, size) } });
}

function storedKeys(): string[] {
  return [...mockSecureStore.keys()].sort();
}

beforeEach(async () => {
  mockSecureStore.clear();
  mockFailures.readKeys.clear();
  mockFailures.writeKeys.clear();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('splitIntoChunks', () => {
  it('keeps every chunk within the byte limit without splitting characters', () => {
    const value = bigValue(9000);
    const chunks = splitIntoChunks(value);

    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.join('')).toBe(value);
    for (const chunk of chunks) {
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(CHUNK_BYTES);
      // A split surrogate pair would turn into U+FFFD when encoded.
      expect(new TextDecoder().decode(new TextEncoder().encode(chunk))).toBe(chunk);
    }
  });

  it('returns no chunks for an empty string', () => {
    expect(splitIntoChunks('')).toEqual([]);
  });
});

describe('toSecureStoreKey', () => {
  it('leaves valid keys alone', () => {
    expect(toSecureStoreKey(KEY)).toBe(KEY);
  });

  it('replaces characters SecureStore rejects', () => {
    const safe = toSecureStoreKey('my key:with/odd·chars');
    expect(safe).toMatch(/^[\w.-]+$/);
    expect(safe).not.toBe(toSecureStoreKey('my key:with/odd-chars'));
  });
});

describe('chunked SecureStore adapter', () => {
  it('round-trips a small value as one chunk plus a count', async () => {
    await storage.setItem(KEY, '{"a":1}');

    expect(await storage.getItem(KEY)).toBe('{"a":1}');
    expect(storedKeys()).toEqual([`${KEY}.0`, `${KEY}.n`]);
    expect(mockSecureStore.get(`${KEY}.n`)).toBe('1');
  });

  it('round-trips a large value across several chunks', async () => {
    const value = bigValue(9000);

    await storage.setItem(KEY, value);

    expect(await storage.getItem(KEY)).toBe(value);
    const count = Number(mockSecureStore.get(`${KEY}.n`));
    expect(count).toBe(splitIntoChunks(value).length);
    expect(count).toBeGreaterThan(3);
  });

  it('round-trips an empty string', async () => {
    await storage.setItem(KEY, '');
    expect(await storage.getItem(KEY)).toBe('');
  });

  it('survives an app restart (the bug: the session was gone after reopening the app)', async () => {
    const value = bigValue(5000);
    await storage.setItem(KEY, value);

    // A fresh copy of the module, as after relaunching the app, reading what's on "disk".
    let restored: string | null = null;
    await jest.isolateModulesAsync(async () => {
      const relaunched = jest.requireActual<typeof import('@/lib/session-storage.native')>(
        '@/lib/session-storage.native',
      );
      restored = await relaunched.sessionStorageAdapter.getItem(KEY);
    });

    expect(restored).toBe(value);
    expect(storedKeys()).toContain(`${KEY}.n`);
  });

  it('removes leftover chunks when a value is overwritten by a shorter one', async () => {
    await storage.setItem(KEY, bigValue(9000));
    const longCount = Number(mockSecureStore.get(`${KEY}.n`));

    await storage.setItem(KEY, '{"short":true}');

    expect(await storage.getItem(KEY)).toBe('{"short":true}');
    expect(storedKeys()).toEqual([`${KEY}.0`, `${KEY}.n`]);
    expect(longCount).toBeGreaterThan(1);
  });

  it('returns null, without throwing or deleting anything, when a chunk is missing', async () => {
    await storage.setItem(KEY, bigValue(9000));
    await storage.setItem('other-key', 'other value');
    mockSecureStore.delete(`${KEY}.1`);
    const before = storedKeys();

    await expect(storage.getItem(KEY)).resolves.toBeNull();

    expect(storedKeys()).toEqual(before);
    expect(await storage.getItem('other-key')).toBe('other value');
  });

  it('returns null when the count is missing or malformed', async () => {
    await storage.setItem(KEY, 'value');

    mockSecureStore.set(`${KEY}.n`, 'not a number');
    await expect(storage.getItem(KEY)).resolves.toBeNull();

    mockSecureStore.delete(`${KEY}.n`);
    await expect(storage.getItem(KEY)).resolves.toBeNull();
  });

  it('returns null instead of throwing when SecureStore fails to read', async () => {
    await storage.setItem(KEY, 'value');
    mockFailures.readKeys.add(`${KEY}.0`);

    await expect(storage.getItem(KEY)).resolves.toBeNull();
  });

  it('never exposes a mix of old and new chunks when an overwrite fails halfway', async () => {
    await storage.setItem(KEY, bigValue(9000));
    mockFailures.writeKeys.add(`${KEY}.1`);

    await expect(storage.setItem(KEY, bigValue(8000))).rejects.toThrow('Write failed');

    await expect(storage.getItem(KEY)).resolves.toBeNull();
  });

  it('removeItem clears every chunk and the count, and nothing else', async () => {
    await storage.setItem(KEY, bigValue(9000));
    await storage.setItem('other-key', 'other value');

    await storage.removeItem(KEY);

    expect(await storage.getItem(KEY)).toBeNull();
    expect(storedKeys()).toEqual(['other-key.0', 'other-key.n']);
  });

  it('stores keys with characters SecureStore rejects', async () => {
    const oddKey = 'sb:project/auth token';

    await storage.setItem(oddKey, bigValue(4000));

    expect(await storage.getItem(oddKey)).toBe(bigValue(4000));
    for (const key of storedKeys()) expect(key).toMatch(/^[\w.-]+$/);
  });

  it('deletes the old AES-format entries on first read, so the user just signs in again', async () => {
    await AsyncStorage.setItem(KEY, 'old ciphertext');
    mockSecureStore.set(KEY, 'old aes key hex');

    // The first launch after the update: a fresh module (the cleanup runs once per key per run).
    let result: string | null = 'not read';
    await jest.isolateModulesAsync(async () => {
      const updated = jest.requireActual<typeof import('@/lib/session-storage.native')>(
        '@/lib/session-storage.native',
      );
      result = await updated.sessionStorageAdapter.getItem(KEY);
    });

    expect(result).toBeNull();

    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockSecureStore.has(KEY)).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(KEY);
  });
});
