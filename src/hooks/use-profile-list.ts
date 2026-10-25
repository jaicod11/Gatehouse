import { useCallback, useEffect, useRef, useState } from 'react';

import { listProfiles, PROFILE_MESSAGES, ProfilesError, type Profile } from '@/lib/profiles';

export type ProfileListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profiles: Profile[] };

async function fetchListState(): Promise<ProfileListState> {
  try {
    return { status: 'ready', profiles: await listProfiles() };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof ProfilesError ? error.message : PROFILE_MESSAGES.listFailed,
    };
  }
}

/**
 * Loads every profile the caller may read. `retry` starts over from the loading state;
 * `refresh` reloads quietly, keeping the current rows on screen until the new ones arrive.
 */
export function useProfileList() {
  const [state, setState] = useState<ProfileListState>({ status: 'loading' });
  // Only the latest request may update the state.
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    return fetchListState().then((next) => {
      if (request === latestRequest.current) setState(next);
    });
  }, []);

  useEffect(() => {
    void load();
    const requests = latestRequest;
    return () => {
      // Drop the response of a request still in flight when the screen goes away.
      requests.current += 1;
    };
  }, [load]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void load();
  }, [load]);

  return { state, retry, refresh: load };
}
