import { useState } from 'react';
import { useDidShow } from '@tarojs/taro';
import { getCurrentSession, syncCurrentUser } from '../services/app-service';
import type { UserProfile } from '../types/entities';

export function useSessionUser() {
  const [user, setUser] = useState<UserProfile | null>(getCurrentSession()?.user || null);

  const refresh = async () => {
    try {
      const nextUser = await syncCurrentUser();
      setUser(nextUser);
      return nextUser;
    } catch {
      const fallbackUser = getCurrentSession()?.user || null;
      setUser(fallbackUser);
      return fallbackUser;
    }
  };

  useDidShow(() => {
    void refresh();
  });

  return {
    user,
    loggedIn: Boolean(user),
    setUser,
    refresh,
  };
}
