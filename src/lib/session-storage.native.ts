import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedStorage } from '@supabase/supabase-js';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage for iOS and Android.
 *
 * SecureStore (Keychain / Keystore) is the right home for secrets but isn't reliable for large
 * values, and a Supabase session can exceed 2KB. So, following Supabase's "LargeSecureStore"
 * pattern, each write generates a fresh AES-256 key, keeps the key in SecureStore and keeps only
 * the encrypted session in AsyncStorage. expo-crypto's AES-GCM replaces the aes-js CTR cipher from
 * Supabase's example: it's native, and its auth tag rejects tampered or mismatched data.
 */

// Writes are two steps (key, then data), so operations on the same key run one at a time.
const queues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const result = (queues.get(key) ?? Promise.resolve()).then(task, task);
  queues.set(
    key,
    result.catch(() => undefined),
  );
  return result;
}

async function remove(key: string): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(key), SecureStore.deleteItemAsync(key)]);
}

export const sessionStorageAdapter: SupportedStorage = {
  getItem: (key) =>
    serialized(key, async () => {
      const [sealed, keyHex] = await Promise.all([
        AsyncStorage.getItem(key),
        SecureStore.getItemAsync(key),
      ]);
      if (!sealed || !keyHex) return null;
      try {
        const aesKey = await AESEncryptionKey.import(keyHex, 'hex');
        const bytes = await aesDecryptAsync(AESSealedData.fromCombined(sealed), aesKey);
        return new TextDecoder().decode(bytes);
      } catch {
        // Tampered, or key and data out of sync (an interrupted write, a partial restore). Treat it
        // as signed out rather than crash.
        await remove(key);
        return null;
      }
    }),

  setItem: (key, value) =>
    serialized(key, async () => {
      const aesKey = await AESEncryptionKey.generate();
      const sealed = await aesEncryptAsync(new TextEncoder().encode(value), aesKey);
      await SecureStore.setItemAsync(key, await aesKey.encoded('hex'));
      await AsyncStorage.setItem(key, await sealed.combined('base64'));
    }),

  removeItem: (key) => serialized(key, () => remove(key)),
};
