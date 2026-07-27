import type { AdminSession } from '../../types/api';

const ADMIN_SESSION_KEY = 'campus-growth-admin-session';
const ADMIN_SESSION_EVENT = 'campus-growth-admin-session-change';

let cachedRawAdminSession: string | null | undefined;
let cachedAdminSession: AdminSession | null = null;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitAdminSessionChange() {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EVENT));
}

function readAdminSessionSnapshot(): AdminSession | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (raw === cachedRawAdminSession) {
      return cachedAdminSession;
    }

    cachedRawAdminSession = raw;
    cachedAdminSession = raw ? (JSON.parse(raw) as AdminSession) : null;
    return cachedAdminSession;
  } catch {
    cachedRawAdminSession = null;
    cachedAdminSession = null;
    return null;
  }
}

export function getStoredAdminSession(): AdminSession | null {
  return readAdminSessionSnapshot();
}

export function setStoredAdminSession(session: AdminSession) {
  if (!canUseStorage()) {
    return;
  }

  const nextRaw = JSON.stringify(session);
  if (nextRaw === cachedRawAdminSession) {
    return;
  }

  window.localStorage.setItem(ADMIN_SESSION_KEY, nextRaw);
  cachedRawAdminSession = nextRaw;
  cachedAdminSession = session;
  emitAdminSessionChange();
}

export function clearStoredAdminSession() {
  if (!canUseStorage()) {
    return;
  }

  const hadSession =
    cachedRawAdminSession !== undefined ? cachedRawAdminSession !== null : window.localStorage.getItem(ADMIN_SESSION_KEY) !== null;
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
  cachedRawAdminSession = null;
  cachedAdminSession = null;

  if (hadSession) {
    emitAdminSessionChange();
  }
}

export function getAdminAuthToken() {
  return getStoredAdminSession()?.token || '';
}

export function subscribeAdminSession(listener: () => void) {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_SESSION_KEY) {
      cachedRawAdminSession = undefined;
      listener();
    }
  };

  const handleCustomChange = () => listener();

  window.addEventListener(ADMIN_SESSION_EVENT, handleCustomChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(ADMIN_SESSION_EVENT, handleCustomChange);
    window.removeEventListener('storage', handleStorage);
  };
}
