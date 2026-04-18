import { useCallback, useEffect, useMemo, useState, type DependencyList } from 'react';

interface UseAsyncDataOptions<T> {
  initialData: T;
  retryCount?: number;
  retryDelayMs?: number;
}

interface UseAsyncDataResult<T> {
  data: T;
  loading: boolean;
  error: unknown;
  refresh: () => void;
}

const waitFor = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      resolve();
    }, ms);

    if (signal.aborted) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError';

export const useAsyncData = <T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: UseAsyncDataOptions<T>
): UseAsyncDataResult<T> => {
  const { initialData, retryCount = 0, retryDelayMs = 0 } = options;
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        if (controller.signal.aborted) {
          return;
        }

        try {
          const nextData = await fetcher(controller.signal);
          if (cancelled || controller.signal.aborted) {
            return;
          }

          setData(nextData);
          setLoading(false);
          return;
        } catch (fetchError) {
          if (cancelled || controller.signal.aborted || isAbortError(fetchError)) {
            return;
          }

          const shouldRetry = attempt < retryCount;
          if (shouldRetry && retryDelayMs > 0) {
            await waitFor(retryDelayMs, controller.signal);
            if (cancelled || controller.signal.aborted) {
              return;
            }
          } else if (!shouldRetry) {
            setError(fetchError);
            setLoading(false);
            return;
          }
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetcher, retryCount, retryDelayMs, reloadToken, ...deps]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refresh
    }),
    [data, loading, error, refresh]
  );
};
