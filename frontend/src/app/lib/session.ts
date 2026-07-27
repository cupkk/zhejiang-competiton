import type { LoginSession } from '../../types/api';

const SESSION_KEY = 'campus-growth-session';
const SESSION_EVENT = 'campus-growth-session-change';

let cachedRawSession: string | null | undefined;
let cachedSession: LoginSession | null = null;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitSessionChange() {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

function readSessionSnapshot(): LoginSession | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw === cachedRawSession) {
      return cachedSession;
    }

    cachedRawSession = raw;
    cachedSession = raw ? (JSON.parse(raw) as LoginSession) : null;
    return cachedSession;
  } catch {
    cachedRawSession = null;
    cachedSession = null;
    return null;
  }
}

export function getStoredSession(): LoginSession | null {
  return readSessionSnapshot();
}

export function setStoredSession(session: LoginSession) {
  if (!canUseStorage()) {
    return;
  }

  const nextRaw = JSON.stringify(session);
  if (nextRaw === cachedRawSession) {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, nextRaw);
  cachedRawSession = nextRaw;
  cachedSession = session;
  emitSessionChange();
}

export function clearStoredSession() {
  if (!canUseStorage()) {
    return;
  }

  const hadSession = cachedRawSession !== undefined ? cachedRawSession !== null : window.localStorage.getItem(SESSION_KEY) !== null;
  window.localStorage.removeItem(SESSION_KEY);
  cachedRawSession = null;
  cachedSession = null;

  if (hadSession) {
    emitSessionChange();
  }
}

export function getAuthToken() {
  return getStoredSession()?.token || '';
}

export function subscribeSession(listener: () => void) {
  if (!canUseStorage()) {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY) {
      cachedRawSession = undefined;
      listener();
    }
  };

  const handleCustomChange = () => listener();

  window.addEventListener(SESSION_EVENT, handleCustomChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SESSION_EVENT, handleCustomChange);
    window.removeEventListener('storage', handleStorage);
  };
}
