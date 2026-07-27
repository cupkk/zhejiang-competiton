import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef, useState } from 'react';
import { readCachedData, writeCachedData } from '../lib/query-cache';
import { getRequestErrorMessage, isAuthExpiredError } from '../lib/request-error';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'auth_expired';
export type RequestErrorStatus = Extract<RequestStatus, 'error' | 'auth_expired'>;

type StateFactory<T> = T | (() => T);

interface UseRequestStateOptions<T> {
  initialData: StateFactory<T>;
  fallbackData?: StateFactory<T>;
  errorMessage: string;
  cacheKey?: string;
  cacheTtlMs?: number;
}

function toFactory<T>(value: StateFactory<T>): () => T {
  return typeof value === 'function' ? (value as () => T) : () => value;
}

interface RunOptions {
  preserveDataOnError?: boolean;
  errorMessage?: string;
  forceRefresh?: boolean;
  revalidate?: boolean;
}

export function useRequestState<T>({
  initialData,
  fallbackData,
  errorMessage: defaultErrorMessage,
  cacheKey,
  cacheTtlMs,
}: UseRequestStateOptions<T>) {
  const initialFactoryRef = useRef(toFactory(initialData));
  const fallbackFactoryRef = useRef(toFactory(fallbackData ?? initialData));
  const initialCachedRef = useRef<{ hit: boolean; data?: T } | null>(null);
  if (!initialCachedRef.current) {
    const cachedData = readCachedData<T>(cacheKey, cacheTtlMs);
    initialCachedRef.current = { hit: cachedData !== undefined, data: cachedData };
  }
  const [data, setDataState] = useState<T>(() =>
    initialCachedRef.current?.hit ? (initialCachedRef.current.data as T) : initialFactoryRef.current(),
  );
  const [status, setStatus] = useState<RequestStatus>(() => (initialCachedRef.current?.hit ? 'success' : 'idle'));
  const [errorMessage, setErrorMessage] = useState('');

  const reset = useCallback((nextData?: T, nextStatus: RequestStatus = 'idle') => {
    const resolvedData = nextData ?? initialFactoryRef.current();
    setDataState(resolvedData);
    writeCachedData(cacheKey, resolvedData);
    setStatus(nextStatus);
    setErrorMessage('');
  }, [cacheKey]);

  const setData = useCallback<Dispatch<SetStateAction<T>>>(
    (nextData) => {
      setDataState((currentData) => {
        const resolvedData =
          typeof nextData === 'function' ? (nextData as (previous: T) => T)(currentData) : nextData;
        writeCachedData(cacheKey, resolvedData);
        return resolvedData;
      });
    },
    [cacheKey],
  );

  const run = useCallback(
    async (task: () => Promise<T>, options: RunOptions = {}) => {
      const staleCachedData = readCachedData<T>(cacheKey, cacheTtlMs, true);
      const cachedData = options.forceRefresh ? undefined : readCachedData<T>(cacheKey, cacheTtlMs);

      if (cachedData !== undefined) {
        setDataState(cachedData);
        setStatus('success');
        setErrorMessage('');

        if (!options.revalidate) {
          return cachedData;
        }
      }

      if (cachedData === undefined || !options.revalidate) {
        setStatus('loading');
      }
      setErrorMessage('');

      try {
        const result = await task();
        setDataState(result);
        writeCachedData(cacheKey, result);
        setStatus('success');
        return result;
      } catch (error) {
        const nextStatus: RequestErrorStatus = isAuthExpiredError(error) ? 'auth_expired' : 'error';
        const fallbackCachedData = cachedData ?? staleCachedData;
        if (fallbackCachedData !== undefined && nextStatus !== 'auth_expired' && options.preserveDataOnError !== false) {
          setDataState(fallbackCachedData);
          setStatus('success');
          setErrorMessage('');
          return fallbackCachedData;
        }

        if (!options.preserveDataOnError) {
          setDataState(fallbackFactoryRef.current());
        }

        setStatus(nextStatus);
        setErrorMessage(getRequestErrorMessage(error, options.errorMessage ?? defaultErrorMessage));
        return null;
      }
    },
    [cacheKey, cacheTtlMs, defaultErrorMessage]
  );

  return { data, setData, status, errorMessage, reset, run };
}
