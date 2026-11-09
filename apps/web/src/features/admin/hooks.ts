import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { describeError } from './domain';

interface AdminCacheEntry<T> {
  data: T;
  timestamp: number;
}

const adminQueryCache = new Map<string, AdminCacheEntry<unknown>>();
const adminInFlight = new Map<string, Promise<unknown>>();

export function clearAdminQueryCache(keyPrefix?: string) {
  if (!keyPrefix) {
    adminQueryCache.clear();
    adminInFlight.clear();
    return;
  }
  for (const key of adminQueryCache.keys()) {
    if (key.includes(keyPrefix)) adminQueryCache.delete(key);
  }
  for (const key of adminInFlight.keys()) {
    if (key.includes(keyPrefix)) adminInFlight.delete(key);
  }
}

/**
 * Session-scoped async query with SWR caching and keepPreviousData.
 *
 * SWR caching ensures returning to a previously loaded admin tab is instantaneous (0ms)
 * without flashing full-page Skeletons.
 * keepPreviousData keeps existing table data visible while filtering/paginating,
 * avoiding visual flicker.
 */
export function useAdminQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  enabled = true,
) {
  const { currentUser } = useAuth();
  const identity = `${currentUser?.id}:${currentUser?.permissions.join(',')}:${key}`;
  const latest = useRef(fetcher);
  latest.current = fetcher;
  const [revision, setRevision] = useState(0);

  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: unknown;
    loading: boolean;
  }>(() => ({
    key: identity,
    data: undefined,
    loading: enabled,
  }));

  useEffect(() => {
    let active = true;
    if (!enabled) return;

    setState({
      key: identity,
      data: undefined,
      loading: true,
    });

    let inFlight = adminInFlight.get(identity) as Promise<T> | undefined;
    if (!inFlight) {
      inFlight = latest.current().finally(() => {
        adminInFlight.delete(identity);
      });
      adminInFlight.set(identity, inFlight);
    }

    void inFlight.then(
      (data) => {
        adminQueryCache.set(identity, { data, timestamp: Date.now() });
        if (active) setState({ key: identity, data, loading: false });
      },
      (error) => {
        if (active) setState({ key: identity, error, loading: false });
      },
    );

    return () => {
      active = false;
    };
  }, [identity, revision, enabled]);

  const data = state.key === identity ? state.data : undefined;

  return {
    data,
    error: state.key === identity ? state.error : undefined,
    loading: enabled && (state.key !== identity || state.loading),
    isFetching: enabled && (state.key !== identity || state.loading),
    retry: useCallback(() => {
      adminQueryCache.delete(identity);
      adminInFlight.delete(identity);
      setRevision((n) => n + 1);
    }, [identity]),
  };
}

/** Single-flight mutation with success/error feedback and a double-submit lock. */
export function useAdminMutation() {
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReturnType<typeof describeError> | null>(
    null,
  );
  const [success, setSuccess] = useState('');
  async function run<T>(
    action: () => Promise<T>,
    done: (value: T) => void,
    message = 'Đã lưu thay đổi.',
  ) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    setSuccess('');
    try {
      const value = await action();
      if (!mounted.current) return;
      setSuccess(message);
      done(value);
    } catch (failure) {
      if (mounted.current) setError(describeError(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return { pending, error, success, run };
}
