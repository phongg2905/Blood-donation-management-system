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

export interface ResetPasswordInput {
  /** Token taken from the reset link query string. */
  token: string;
  password: string;
}

/**
 * `PATCH /auth/me` request DTO.
 *
 * The contract accepts `phone`/`address`, but `CurrentUser` does not return
 * them yet, so the profile screen only edits `fullName` for now. Keeping the
 * full DTO here means enabling the other fields later needs no type changes.
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
  /** Registers a DONOR. Does not sign the user in. */
  register(input: RegisterInput): Promise<void>;
  /** Revokes the session server-side. Must not throw for an already-dead session. */
  logout(): Promise<void>;
  /** Current user, or `null` when there is no usable session. */
  getCurrentUser(): Promise<AuthUser | null>;
  forgotPassword(input: ForgotPasswordInput): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  updateProfile(input: UpdateProfileInput): Promise<AuthUser>;
}
