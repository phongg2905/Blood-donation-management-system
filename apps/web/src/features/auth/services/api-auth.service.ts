import type { CurrentUser } from '@blood/shared-types';
import {
  ApiRequestError,
  apiGet,
  apiPatch,
  apiPost,
  setAccessToken,
} from '@/services/api';
import type {
  AuthService,
  AuthUser,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../types';

/**
 * Real adapter for the Phase 2 auth API.
 *
 * Endpoints marked `[confirmed]` are in `docs/api/frontend-contract.md`.
 * Endpoints marked `[unconfirmed]` are **not** in the contract yet — they use the
 * conventional path and are recorded in `TASK_UNTIL_AUTH_INTEGRATED.md`, so they
 * must be re-checked (path, request body, response shape, status codes) before
 * this adapter is switched on.
 *
 * Token handling: the access token lives in memory (see `services/api.ts`) and
 * travels as `Authorization: Bearer`. The refresh token is an HttpOnly cookie
 * handled entirely by the browser — no token is ever written to localStorage.
 */

interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

interface RefreshResponse {
  accessToken: string;
}

const LOGIN_PATH = '/auth/login'; // [confirmed]
const REFRESH_PATH = '/auth/refresh'; // [confirmed]
const LOGOUT_PATH = '/auth/logout'; // [confirmed]
const ME_PATH = '/auth/me'; // [confirmed]
const REGISTER_PATH = '/auth/register'; // [unconfirmed]
const FORGOT_PATH = '/auth/forgot-password'; // [unconfirmed]
const RESET_PATH = '/auth/reset-password'; // [unconfirmed]

export class ApiAuthService implements AuthService {
  async login({ email, password }: LoginInput): Promise<AuthUser> {
    const response = await apiPost<LoginResponse>(
      LOGIN_PATH,
      { email, password },
      { anonymous: true },
    );
    setAccessToken(response.data.accessToken);
    return response.data.user;
  }

  /**
   * Public registration. Sends only `{ fullName, email, password }` — the API
   * assigns the DONOR role; the client cannot request a role.
   */
  async register(input: RegisterInput): Promise<void> {
    await apiPost<unknown>(
      REGISTER_PATH,
      {
        fullName: input.fullName,
        email: input.email,
        password: input.password,
      },
      { anonymous: true },
    );
  }

  async logout(): Promise<void> {
    try {
      await apiPost<unknown>(LOGOUT_PATH, undefined, { anonymous: true });
    } finally {
      // Local session must die even if the server call fails.
      setAccessToken(null);
    }
  }

  /**
   * `GET /auth/me`, with one silent refresh attempt when the access token has
   * expired. Returns `null` instead of throwing so the auth bootstrap can treat
   * "no session" as a normal state.
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const response = await apiGet<CurrentUser>(ME_PATH);
      return response.data;
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 401)
        throw error;
    }

    const refreshed = await this.refresh();
    if (!refreshed) return null;

    try {
      const response = await apiGet<CurrentUser>(ME_PATH);
      return response.data;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setAccessToken(null);
        return null;
      }
      throw error;
    }
  }

  /** Rotates the session using the refresh cookie. `false` when it is gone. */
  private async refresh(): Promise<boolean> {
    try {
      const response = await apiPost<RefreshResponse>(REFRESH_PATH, undefined, {
        anonymous: true,
      });
      setAccessToken(response.data.accessToken);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    }
  }

  async forgotPassword({ email }: ForgotPasswordInput): Promise<void> {
    await apiPost<unknown>(FORGOT_PATH, { email }, { anonymous: true });
  }

  async resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    await apiPost<unknown>(
      RESET_PATH,
      { token, password },
      { anonymous: true },
    );
  }

  async updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    const response = await apiPatch<CurrentUser>(ME_PATH, input);
    return response.data;
  }
}
