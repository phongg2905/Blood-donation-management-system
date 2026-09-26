import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { describeError } from './domain';

/**
 * Session-scoped async query.
 *
 * The key carries the user id and permissions so a late response can never
 * replace the data of a different route or account.
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
  }>({ key: identity, loading: true });

  useEffect(() => {
    let active = true;
    if (!enabled) return;
    setState((previous) => ({
      key: identity,
      ...(previous.key === identity && previous.data !== undefined
        ? { data: previous.data }
        : {}),
      loading: true,
    }));
    void latest.current().then(
      (data) => {
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
    retry: useCallback(() => setRevision((n) => n + 1), []),
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
