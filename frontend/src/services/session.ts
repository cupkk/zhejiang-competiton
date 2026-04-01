import Taro from '@tarojs/taro';
import type { LoginSession } from '../types/api';

const SESSION_KEY = 'campus-growth-session';

export function getStoredSession(): LoginSession | null {
  try {
    return Taro.getStorageSync<LoginSession | ''>(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredSession(session: LoginSession) {
  Taro.setStorageSync(SESSION_KEY, session);
}

export function clearStoredSession() {
  Taro.removeStorageSync(SESSION_KEY);
}

export function getAuthToken() {
  return getStoredSession()?.token || '';
}
