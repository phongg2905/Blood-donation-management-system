/**
 * Frontend-only auth types.
 *
 * `RoleCode`, `PermissionCode` and `CurrentUser` come from
 * `@blood/shared-types` and are never re-declared here — the shared package is
 * the single source of truth for the ones the API also uses.
 */
import type { CurrentUser } from '@blood/shared-types';

export type AuthUser = CurrentUser;

/** Login credentials — mirrors `POST /auth/login`. */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Public self-registration.
 *
 * There is deliberately no `role` field: public registration always creates a
 * `DONOR`. Staff and admin accounts are only created by an ADMIN
 * (`POST /users` + `POST /users/:id/roles`) in a later phase.
 */
export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

/** Development-only token returned while email delivery is unavailable. */
export interface ForgotPasswordResult {
  /** Deliberately identical for known and unknown email addresses. */
  message: string;
  devResetToken?: string;
}

export interface ResetPasswordInput {
  /** Token taken from the reset link query string. */
  token: string;
  password: string;
}

/**
 * `PATCH /auth/me` request DTO.
 *
 * `phone`/`address` apply to DONOR accounts (stored in `DonorProfile`) and are
 * echoed back in `CurrentUser`; STAFF/ADMIN must not send them
 * (`VALIDATION_ERROR`). The profile UI only shows the contact fields for
 * accounts whose `CurrentUser` actually carries them.
 */
export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  address?: string;
}

/**
 * Contract for every auth data source.
 *
 * UI code depends only on this interface, so swapping `MockAuthService` for
 * `ApiAuthService` never touches a page or component.
 */
export interface AuthService {
  /** Resolves the signed-in user; throws on bad credentials / inactive account. */
  login(input: LoginInput): Promise<AuthUser>;
  /** Registers and signs in a DONOR using the session returned by the API. */
  register(input: RegisterInput): Promise<AuthUser>;
  /** Revokes the session server-side. Must not throw for an already-dead session. */
  logout(): Promise<void>;
  /** Current user, or `null` when there is no usable session. */
  getCurrentUser(): Promise<AuthUser | null>;
  forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  updateProfile(input: UpdateProfileInput): Promise<AuthUser>;
}
