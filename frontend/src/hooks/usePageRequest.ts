import { DependencyList, useCallback, useEffect, useRef } from 'react';
import { RunRequestOptions, UseRequestStateOptions, useRequestState } from './useRequestState';

interface UsePageRequestOptions<T> extends UseRequestStateOptions<T> {
  request: () => Promise<T>;
  deps?: DependencyList;
  enabled?: boolean;
  runOptions?: RunRequestOptions<T>;
}

export function usePageRequest<T>({
  request,
  deps = [],
  enabled = true,
  runOptions,
  ...requestStateOptions
}: UsePageRequestOptions<T>) {
  const state = useRequestState<T>(requestStateOptions);
  const requestRef = useRef(request);
  const runOptionsRef = useRef(runOptions);

  requestRef.current = request;
  runOptionsRef.current = runOptions;

  const reload = useCallback(async () => {
    if (!enabled) {
      return null;
    }

    return state.run(() => requestRef.current(), runOptionsRef.current);
  }, [enabled, state.run, ...deps]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void reload();
  }, [enabled, reload]);

  return {
    ...state,
    reload,
  };
}
