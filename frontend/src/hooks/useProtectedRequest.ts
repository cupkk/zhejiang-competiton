import { DependencyList, useCallback, useEffect, useRef } from 'react';
import { RunRequestOptions, UseRequestStateOptions, useRequestState } from './useRequestState';
import { useSessionUser } from './useSessionUser';

type RequestFactory<T> = T | (() => T);

interface UseProtectedRequestOptions<T> extends UseRequestStateOptions<T> {
  request: () => Promise<T>;
  deps?: DependencyList;
  enabled?: boolean;
  requiresAuth?: boolean;
  idleData?: RequestFactory<T>;
  runOptions?: RunRequestOptions<T>;
}

function resolveFactory<T>(value: RequestFactory<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

export function useProtectedRequest<T>({
  request,
  deps = [],
  enabled = true,
  requiresAuth = true,
  idleData,
  runOptions,
  ...requestStateOptions
}: UseProtectedRequestOptions<T>) {
  const session = useSessionUser();
  const state = useRequestState<T>(requestStateOptions);
  const requestRef = useRef(request);
  const runOptionsRef = useRef(runOptions);

  requestRef.current = request;
  runOptionsRef.current = runOptions;

  const reload = useCallback(async () => {
    if (!enabled) {
      return null;
    }

    if (requiresAuth && !session.loggedIn) {
      if (typeof idleData !== 'undefined') {
        state.reset(resolveFactory(idleData), 'idle');
      } else {
        state.reset(undefined, 'idle');
      }

      return null;
    }

    return state.run(() => requestRef.current(), {
      ...runOptionsRef.current,
      onError: async (context) => {
        if (requiresAuth && context.status === 'auth_expired') {
          await session.refresh();
        }

        await runOptionsRef.current?.onError?.(context);
      },
    });
  }, [enabled, requiresAuth, session.loggedIn, session.refresh, state.reset, state.run, idleData, ...deps]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void reload();
  }, [enabled, reload]);

  return {
    ...state,
    reload,
    user: session.user,
    loggedIn: session.loggedIn,
    refreshSession: session.refresh,
    isBlockedByAuth: requiresAuth && !session.loggedIn,
  };
}
