import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CurrentUser,
  PermissionCode,
  RoleCode,
} from '@blood/shared-types';
import { getAuthService } from '../services/auth-service.resolver';
import type {
  AuthService,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../types';
import { AuthContext } from './auth-context';
import type { AuthContextValue, AuthStatus } from './auth-context';

export interface AuthProviderProps {
  children: ReactNode;
  /** Injectable for tests; defaults to the resolved app-wide service. */
  service?: AuthService;
}

const CACHED_USER_KEY = 'bd.auth.cached_user';

function readCachedUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children, service }: AuthProviderProps) {
  const authService = useMemo(() => service ?? getAuthService(), [service]);

  // Synchronously hydrate cached user on frame 0 to eliminate blank white screen on F5.
  // In tests where an explicit mock service is injected, let the mock service dictate initial lifecycle.
  const cachedUser = useMemo(() => (!service ? readCachedUser() : null), [service]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => cachedUser);
  const [status, setStatus] = useState<AuthStatus>(() =>
    cachedUser ? 'authenticated' : 'loading',
  );

  const applyUser = useCallback((user: CurrentUser | null) => {
    setCurrentUser(user);
    setStatus(user ? 'authenticated' : 'anonymous');
    if (typeof window !== 'undefined') {
      try {
        if (user) {
          window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
        } else {
          window.localStorage.removeItem(CACHED_USER_KEY);
        }
      } catch {
        /* storage disabled */
      }
    }
  }, []);

  // Restore or revalidate the session once per service instance.
  useEffect(() => {
    let cancelled = false;
    // Only mark status as 'loading' if we didn't already have an initial authenticated user.
    // If we have a cached user, keep the page visible while revalidating in background.
    if (!cachedUser) {
      setStatus('loading');
    }
    void authService
      .getCurrentUser()
      .then((user) => {
        if (!cancelled) applyUser(user);
      })
      .catch(() => {
        // A failing session check must not trap the app on the loader.
        if (!cancelled) applyUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authService, applyUser, cachedUser]);

  const login = useCallback(
    async (input: LoginInput) => {
      const user = await authService.login(input);
      applyUser(user);
      return user;
    },
    [authService, applyUser],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const user = await authService.register(input);
      applyUser(user);
      return user;
    },
    [authService, applyUser],
  );

  const forgotPassword = useCallback(
    (input: ForgotPasswordInput) => authService.forgotPassword(input),
    [authService],
  );

  const resetPassword = useCallback(
    (input: ResetPasswordInput) => authService.resetPassword(input),
    [authService],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      // Local state is cleared even when the server call fails.
      applyUser(null);
    }
  }, [authService, applyUser]);

  const refreshCurrentUser = useCallback(async () => {
    const user = await authService.getCurrentUser();
    applyUser(user);
    return user;
  }, [authService, applyUser]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      const user = await authService.updateProfile(input);
      applyUser(user);
      return user;
    },
    [authService, applyUser],
  );

  const value = useMemo<AuthContextValue>(() => {
    const roles = currentUser?.roles ?? [];
    const permissions = currentUser?.permissions ?? [];
    return {
      currentUser,
      status,
      isAuthenticated: status === 'authenticated' && currentUser !== null,
      isLoading: status === 'loading',
      login,
      register,
      forgotPassword,
      resetPassword,
      logout,
      updateProfile,
      refreshCurrentUser,
      hasRole: (...required: RoleCode[]) =>
        required.some((role) => roles.includes(role)),
      hasPermission: (permission: PermissionCode) =>
        permissions.includes(permission),
      hasAnyPermission: (required: readonly PermissionCode[]) =>
        required.some((permission) => permissions.includes(permission)),
      hasAllPermissions: (required: readonly PermissionCode[]) =>
        required.every((permission) => permissions.includes(permission)),
    };
  }, [
    currentUser,
    status,
    login,
    register,
    forgotPassword,
    resetPassword,
    logout,
    updateProfile,
    refreshCurrentUser,
  ]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
