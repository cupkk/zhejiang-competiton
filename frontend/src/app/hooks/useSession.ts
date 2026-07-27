import { useSyncExternalStore } from 'react';
import { getCurrentSession, syncCurrentUser } from '../lib/app-service';
import { getStoredSession, subscribeSession } from '../lib/session';

export function useSession() {
  const session = useSyncExternalStore(subscribeSession, getStoredSession, getStoredSession);

  return {
    session,
    user: session?.user ?? null,
    loggedIn: Boolean(session?.token),
    refresh: syncCurrentUser,
    current: getCurrentSession,
  };
}
