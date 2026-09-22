import { createContext } from 'react';
import type {
  CurrentUser,
  PermissionCode,
  RoleCode,
} from '@blood/shared-types';
import type {
  ForgotPasswordInput,
  ForgotPasswordResult,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  /** `null` until the session is known, and whenever the user is anonymous. */
  currentUser: CurrentUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /** True during the initial session restore. */
  isLoading: boolean;
  login(input: LoginInput): Promise<CurrentUser>;
  register(input: RegisterInput): Promise<CurrentUser>;
  forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  logout(): Promise<void>;
  /** Updates the signed-in user's profile and refreshes `currentUser`. */
  updateProfile(input: UpdateProfileInput): Promise<CurrentUser>;
  /** Re-reads the session (used after the API rotates a token). */
  refreshCurrentUser(): Promise<CurrentUser | null>;
  /** Any-of: true when the user holds at least one of the given roles. */
  hasRole(...roles: RoleCode[]): boolean;
  hasPermission(permission: PermissionCode): boolean;
  hasAnyPermission(permissions: readonly PermissionCode[]): boolean;
  hasAllPermissions(permissions: readonly PermissionCode[]): boolean;
}

/**
 * Roles and permissions are read from `currentUser` only — never mirrored into
 * separate state, so they can never drift from the session.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
