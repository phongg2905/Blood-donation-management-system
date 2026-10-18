import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { describeError } from './domain';

export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

interface CampaignCacheEntry<T> {
  data: T;
  timestamp: number;
}

const campaignQueryCache = new Map<string, CampaignCacheEntry<unknown>>();
const campaignInFlight = new Map<string, Promise<unknown>>();

export function clearCampaignQueryCache(keyPrefix?: string) {
  if (!keyPrefix) {
    campaignQueryCache.clear();
    campaignInFlight.clear();
    return;
  }
  for (const key of campaignQueryCache.keys()) {
    if (key.includes(keyPrefix)) {
      campaignQueryCache.delete(key);
    }
  }
  for (const key of campaignInFlight.keys()) {
    if (key.includes(keyPrefix)) {
      campaignInFlight.delete(key);
    }
  }
}

/** Request keys + session identity prevent late responses replacing a new route/user with SWR caching. */
export function useCampaignQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  enabled = true,
) {
  const { currentUser } = useAuth();
  const identity = `${currentUser?.id}:${currentUser?.permissions.join(',')}:${key}`;
  const latest = useRef(fetcher);
  latest.current = fetcher;
  const [revision, setRevision] = useState(0);

  const cached = enabled
    ? (campaignQueryCache.get(identity) as CampaignCacheEntry<T> | undefined)
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

    const currentCached = campaignQueryCache.get(identity) as
      | CampaignCacheEntry<T>
      | undefined;
    const hasData = currentCached?.data !== undefined;

    if (!hasData) {
      setState((previous) => ({
        key: identity,
        data: previous.key === identity ? previous.data : undefined,
        loading: true,
      }));
    }

    let inFlight = campaignInFlight.get(identity) as Promise<T> | undefined;
    if (!inFlight) {
      inFlight = latest.current().finally(() => {
        campaignInFlight.delete(identity);
      });
      campaignInFlight.set(identity, inFlight);
    }

    void inFlight.then(
      (data) => {
        campaignQueryCache.set(identity, { data, timestamp: Date.now() });
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
      campaignQueryCache.delete(identity);
      campaignInFlight.delete(identity);
      setRevision((n) => n + 1);
    }, [identity]),
  };
}
export function useCampaignMutation() {
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
