import { useEffect, useSyncExternalStore } from 'react';
import { getCurrentAdminSession, syncCurrentAdmin } from '../lib/app-service';
import { getStoredAdminSession, subscribeAdminSession } from '../lib/admin-session';

export function useAdminSession() {
  const session = useSyncExternalStore(subscribeAdminSession, getStoredAdminSession, getStoredAdminSession);

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    void syncCurrentAdmin().catch(() => undefined);
  }, [session?.token]);

  return {
    session,
    admin: session?.admin ?? null,
    loggedIn: Boolean(session?.token),
    refresh: syncCurrentAdmin,
    current: getCurrentAdminSession,
  };
}
