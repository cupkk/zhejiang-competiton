export type RequestErrorKind = 'auth_expired' | 'network' | 'response' | 'business' | 'unknown';

interface RequestErrorOptions {
  message: string;
  kind: RequestErrorKind;
  statusCode?: number;
}

export class RequestError extends Error {
  kind: RequestErrorKind;
  statusCode?: number;

  constructor({ message, kind, statusCode }: RequestErrorOptions) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export function isAuthExpiredError(error: unknown) {
  return error instanceof RequestError && error.kind === 'auth_expired';
}

export function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
