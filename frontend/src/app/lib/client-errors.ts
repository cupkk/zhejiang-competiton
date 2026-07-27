import { getApiBaseUrl } from './http';

type ClientErrorKind = 'runtime' | 'promise' | 'route';

const recentReports = new Map<string, number>();

function errorText(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  return 'Unknown client error';
}

function errorStack(value: unknown) {
  return value instanceof Error ? value.stack || '' : '';
}

export function reportClientError(kind: ClientErrorKind, error: unknown, source = '') {
  const message = errorText(error).slice(0, 500);
  const path = `${window.location.pathname}${window.location.hash}`.slice(0, 300);
  const fingerprint = `${kind}:${path}:${message}`;
  const now = Date.now();
  if (now - (recentReports.get(fingerprint) || 0) < 60_000) return;
  recentReports.set(fingerprint, now);

  const payload = JSON.stringify({
    kind,
    message,
    stack: errorStack(error).slice(0, 2_000),
    path,
    source: source.slice(0, 200),
  });
  const url = `${getApiBaseUrl()}/client-errors`;

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    return;
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function installClientErrorReporting() {
  window.addEventListener('error', (event) => {
    reportClientError('runtime', event.error || event.message, event.filename || '');
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError('promise', event.reason);
  });
}
