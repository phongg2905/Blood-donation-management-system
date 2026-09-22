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

export function AuthProvider({ children, service }: AuthProviderProps) {
  const authService = useMemo(() => service ?? getAuthService(), [service]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const applyUser = useCallback((user: CurrentUser | null) => {
    setCurrentUser(user);
    setStatus(user ? 'authenticated' : 'anonymous');
  }, []);

  // Restore the session once per service instance.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
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
  }, [authService, applyUser]);

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
