import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { describeError } from './domain';

interface WorkflowCacheEntry<T> {
  data: T;
  timestamp: number;
}

const workflowQueryCache = new Map<string, WorkflowCacheEntry<unknown>>();
const workflowInFlight = new Map<string, Promise<unknown>>();

export function clearWorkflowQueryCache(keyPrefix?: string) {
  if (!keyPrefix) {
    workflowQueryCache.clear();
    workflowInFlight.clear();
    return;
  }
  for (const key of workflowQueryCache.keys()) {
    if (key.includes(keyPrefix)) {
      workflowQueryCache.delete(key);
    }
  }
  for (const key of workflowInFlight.keys()) {
    if (key.includes(keyPrefix)) {
      workflowInFlight.delete(key);
    }
  }
}

/**
 * Session-scoped async query with SWR caching and request deduplication.
 *
 * The key includes the user id and permissions so a late response can never
 * replace the data of a different route or user, matching the campaign hooks.
 */
export function useWorkflowQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  enabled = true,
) {
  const { currentUser } = useAuth();
  const identity = `${currentUser?.id}:${key}`;
  const latest = useRef(fetcher);
  latest.current = fetcher;
  const [revision, setRevision] = useState(0);

  const cached = enabled
    ? (workflowQueryCache.get(identity) as WorkflowCacheEntry<T> | undefined)
    : undefined;

  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: unknown;
    loading: boolean;
  }>(() => ({
    key: identity,
    data: cached?.data,
    loading: enabled && cached?.data === undefined,
  }));

  useEffect(() => {
    let active = true;
    if (!enabled) return;

    const currentCached = workflowQueryCache.get(identity) as
      | WorkflowCacheEntry<T>
      | undefined;
    const hasData = currentCached?.data !== undefined;

    if (!hasData) {
      setState((previous) => ({
        key: identity,
        data: previous.key === identity ? previous.data : undefined,
        loading: true,
      }));
    }

    let inFlight = workflowInFlight.get(identity) as Promise<T> | undefined;
    if (!inFlight) {
      inFlight = latest.current().finally(() => {
        workflowInFlight.delete(identity);
      });
      workflowInFlight.set(identity, inFlight);
    }

    void inFlight.then(
      (data) => {
        workflowQueryCache.set(identity, { data, timestamp: Date.now() });
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

  return {
    data: state.key === identity ? state.data : undefined,
    error: state.key === identity ? state.error : undefined,
    loading: enabled && (state.key !== identity || state.loading),
    retry: useCallback(() => {
      workflowQueryCache.delete(identity);
      workflowInFlight.delete(identity);
      setRevision((n) => n + 1);
    }, [identity]),
  };
}

/** Single-flight mutation with success/error feedback and a double-submit lock. */
export function useWorkflowMutation() {
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
  return { pending, error, success, run, reset: () => setSuccess('') };
}
