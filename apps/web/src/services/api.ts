import type {
  ApiFieldErrors,
  ApiResponse,
  ApiSuccess,
  PaginationMeta,
} from '@blood/shared-types';

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(
  /\/$/,
  '',
);

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Access token holder.
 *
 * The access token is intentionally kept in memory only (never localStorage):
 * the refresh token lives in an HttpOnly cookie, so a page reload re-authenticates
 * through `POST /auth/refresh`. `ApiAuthService` owns writing this value; UI code
 * must never touch it.
 */
let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

/**
 * Single-flight refresh coordination.
 *
 * The refresh cookie is single-use (the backend rotates it on every
 * `POST /auth/refresh` and revokes the whole session chain when a rotated-out
 * cookie is replayed). Two overlapping 401s that each fired their own refresh
 * would therefore kill the session — the losing request looks like a replay.
 * This happened on every page reload in development: React StrictMode runs
 * the auth bootstrap effect twice, both calls hit `/auth/me` without a token
 * and both raced to refresh. Everyone with an expired access token now awaits
 * one shared refresh promise instead.
 */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Runs the session rotation through the refresh cookie. All concurrent callers
 * share a single request; the cookie is consumed at most once and every waiter
 * receives the same outcome. Resolves `false` when the cookie is gone/expired,
 * which is a normal anonymous state rather than an error.
 */
export const refreshSession = (refresh: () => Promise<boolean>): Promise<boolean> => {
  refreshInFlight ??= refresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

/** Test hook: drop any shared refresh promise between tests. */
export const resetRefreshQueue = (): void => {
  refreshInFlight = null;
};

/** Normalised API failure. Branch on `code`, never on `message`. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: ApiFieldErrors | null;

  constructor(
    code: string,
    message: string,
    status: number,
    fields: ApiFieldErrors | null = null,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  /** Field-level message for a form input, if the API supplied one. */
  fieldError(field: string): string | undefined {
    return this.fields?.[field];
  }
}

/** Transport/abort failures are not API errors; keep them distinguishable. */
export class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Skip the Authorization header (login, register, health check). */
  anonymous?: boolean;
  timeoutMs?: number;
}

/**
 * What a call resolves to. Failures are always thrown as `ApiRequestError`, so
 * callers never have to narrow a union to reach `data`. List endpoints expose
 * their pagination through the optional `meta`.
 */
export type ApiSuccessResult<T> = ApiSuccess<T> & { meta?: PaginationMeta };

/**
 * Installed by `ApiAuthService` (see `features/auth/services/api-auth.service.ts`)
 * to avoid a circular import. Returns `true` when the access token was
 * replaced with a fresh one and the failed request is worth retrying once.
 */
export type RefreshHandler = () => Promise<boolean>;

let refreshHandler: RefreshHandler | null = null;

export const setRefreshHandler = (handler: RefreshHandler | null): void => {
  refreshHandler = handler;
};

const isApiFailure = <T>(
  body: unknown,
): body is Extract<ApiResponse<T>, { success: false }> =>
  typeof body === 'object' &&
  body !== null &&
  'success' in body &&
  (body as { success: unknown }).success === false;

async function request<T>(
  method: string,
  path: string,
  payload?: unknown,
  options: RequestOptions = {},
): Promise<ApiSuccessResult<T>> {
  try {
    return await requestOnce<T>(method, path, payload, options);
  } catch (error) {
    // One silent retry through the refresh cookie when the access token has
    // expired. Concurrent 401s share a single refresh (single-flight), so the
    // single-use cookie is never consumed twice. `/auth/refresh` itself never
    // retries — that would loop on a dead cookie.
    const handler = refreshHandler;
    const retriable =
      handler !== null &&
      !options.anonymous &&
      error instanceof ApiRequestError &&
      error.status === 401;
    if (!retriable || handler === null) throw error;
    if (!(await handler().catch(() => false))) throw error;
    return requestOnce<T>(method, path, payload, options);
  }
}

async function requestOnce<T>(
  method: string,
  path: string,
  payload: unknown,
  options: RequestOptions,
): Promise<ApiSuccessResult<T>> {
  const { signal, anonymous = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal:
        signal ?? (AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : null),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    throw new ApiNetworkError(
      error instanceof Error ? error.message : 'Không thể kết nối API',
    );
  }

  const isEmpty = response.status === 204;
  let body: unknown = null;
  if (!isEmpty) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok || isApiFailure<T>(body)) {
    const error = isApiFailure<T>(body) ? body.error : undefined;
    throw new ApiRequestError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `HTTP ${response.status}`,
      response.status,
      error?.fields ?? null,
    );
  }

  if (isEmpty) {
    return { success: true, data: {} as T };
  }
  return body as ApiSuccessResult<T>;
}

export const apiGet = <T>(path: string, options?: RequestOptions) =>
  request<T>('GET', path, undefined, options);

export const apiPost = <T>(
  path: string,
  payload?: unknown,
  options?: RequestOptions,
) => request<T>('POST', path, payload, options);

export const apiPut = <T>(
  path: string,
  payload?: unknown,
  options?: RequestOptions,
) => request<T>('PUT', path, payload, options);

export const apiPatch = <T>(
  path: string,
  payload?: unknown,
  options?: RequestOptions,
) => request<T>('PATCH', path, payload, options);

export const apiDelete = <T>(path: string, options?: RequestOptions) =>
  request<T>('DELETE', path, undefined, options);
