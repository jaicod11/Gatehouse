import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Web: no adapter, so supabase-js falls back to its default, window.localStorage. iOS and Android
 * resolve session-storage.native.ts instead.
 */
export const sessionStorageAdapter: SupportedStorage | undefined = undefined;
