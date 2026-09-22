import type { CurrentUser, RoleCode } from '@blood/shared-types';

/** Every auth-related path in one place, so no page hard-codes a string. */
export const AUTH_ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  forbidden: '/403',
  systemStatus: '/system-status',
} as const;

export type AppLayoutKind = 'donor' | 'staff' | 'admin';

/**
 * Landing path per role.
 *
 * Phase 2 only ships `/profile`, so every role lands there. When Phase 3 adds
 * real dashboards this table is the single place to change — pages read the
 * result and never decide a destination themselves.
 */
const ROLE_LANDING_PATHS: Readonly<Record<RoleCode, string>> = {
  DONOR: '/profile',
  RECEPTION_STAFF: '/profile',
  MEDICAL_STAFF: '/profile',
  BLOOD_COLLECTION_STAFF: '/profile',
  ADMIN: '/profile',
};

/** Most-privileged first. Used for layout choice and landing resolution. */
const ROLE_PRIORITY: readonly RoleCode[] = [
  'ADMIN',
  'BLOOD_COLLECTION_STAFF',
  'MEDICAL_STAFF',
  'RECEPTION_STAFF',
  'DONOR',
];

export const primaryRole = (roles: readonly RoleCode[]): RoleCode | null => {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return null;
};

/**
 * Which app shell a user gets: DONOR → donor shell, the three staff roles →
 * staff shell, ADMIN → admin shell (`§18` of the Phase 2 brief).
 */
export function resolveLayoutKind(
  roles: readonly RoleCode[] | undefined,
): AppLayoutKind {
  const role = primaryRole(roles ?? []);
  if (role === 'ADMIN') return 'admin';
  if (role === null || role === 'DONOR') return 'donor';
  return 'staff';
}

/** Roles that belong to the staff shell. */
export const STAFF_ROLES: readonly RoleCode[] = [
  'RECEPTION_STAFF',
  'MEDICAL_STAFF',
  'BLOOD_COLLECTION_STAFF',
];

const UNSAFE_PREFIXES: readonly string[] = [
  AUTH_ROUTES.login,
  AUTH_ROUTES.register,
  AUTH_ROUTES.forgotPassword,
  AUTH_ROUTES.resetPassword,
];

/**
 * Guard against open redirects (`//evil.com`, `https://evil.com`) and against
 * bouncing a freshly signed-in user back to an auth screen.
 */
export function isSafeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://') || path.includes('\\')) return false;
  return !UNSAFE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}?`),
  );
}

/** Where the user should land after signing in. */
export function resolveLandingPath(user: CurrentUser | null): string {
  const role = primaryRole(user?.roles ?? []);
  if (!role) return user ? AUTH_ROUTES.forbidden : AUTH_ROUTES.login;
  return ROLE_LANDING_PATHS[role];
}

/**
 * Post-login destination: the page the user was blocked from when there is one
 * (set by `ProtectedRoute` via router state), otherwise the role landing page.
 */
export function resolvePostLoginPath(
  user: CurrentUser | null,
  from?: unknown,
): string {
  if (isSafeRedirectPath(from)) return from;
  return resolveLandingPath(user);
}

/** Reads `location.state.from` without trusting its shape. */
export function redirectTargetFromState(state: unknown): unknown {
  if (typeof state !== 'object' || state === null) return undefined;
  return (state as { from?: unknown }).from;
}

/** Email carried over from a previous screen (e.g. after registering). */
export function emailFromState(state: unknown): string {
  if (typeof state !== 'object' || state === null) return '';
  const email = (state as { email?: unknown }).email;
  return typeof email === 'string' ? email : '';
}

/** Logout always returns to the login screen. */
export const resolvePostLogoutPath = (): string => AUTH_ROUTES.login;
