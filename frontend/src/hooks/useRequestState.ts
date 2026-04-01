import { useCallback, useRef, useState } from 'react';
import { getRequestErrorMessage, isAuthExpiredError } from '../utils/request-error';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'auth_expired';
export type RequestErrorStatus = Extract<RequestStatus, 'error' | 'auth_expired'>;

type RequestStateFactory<T> = T | (() => T);

export interface UseRequestStateOptions<T> {
  initialData: RequestStateFactory<T>;
  fallbackData?: RequestStateFactory<T>;
  errorMessage: string;
}

export interface RunRequestOptions<T> {
  errorMessage?: string;
  preserveDataOnError?: boolean;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (context: {
    error: unknown;
    message: string;
    status: RequestErrorStatus;
  }) => void | Promise<void>;
}

function toFactory<T>(value: RequestStateFactory<T>): () => T {
  return typeof value === 'function' ? (value as () => T) : () => value;
}

export function useRequestState<T>({
  initialData,
  fallbackData,
  errorMessage: defaultErrorMessage,
}: UseRequestStateOptions<T>) {
  const initialFactoryRef = useRef(toFactory(initialData));
  const fallbackFactoryRef = useRef(toFactory(fallbackData ?? initialData));
  const [data, setData] = useState<T>(() => initialFactoryRef.current());
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const reset = useCallback((nextData?: T, nextStatus: RequestStatus = 'idle') => {
    setData(nextData ?? initialFactoryRef.current());
    setStatus(nextStatus);
    setErrorMessage('');
  }, []);

  const run = useCallback(
    async (task: () => Promise<T>, options: RunRequestOptions<T> = {}) => {
      setStatus('loading');
      setErrorMessage('');

      try {
        const result = await task();
        setData(result);
        setStatus('success');
        await options.onSuccess?.(result);
        return result;
      } catch (error) {
        if (!options.preserveDataOnError) {
          setData(fallbackFactoryRef.current());
        }

        const message = getRequestErrorMessage(error, options.errorMessage ?? defaultErrorMessage);
        const nextStatus: RequestErrorStatus = isAuthExpiredError(error) ? 'auth_expired' : 'error';

        setErrorMessage(message);
        setStatus(nextStatus);
        await options.onError?.({ error, message, status: nextStatus });

        return null;
      }
    },
    [defaultErrorMessage]
  );

  return {
    data,
    setData,
    status,
    errorMessage,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
    isAuthExpired: status === 'auth_expired',
    reset,
    run,
  };
}
