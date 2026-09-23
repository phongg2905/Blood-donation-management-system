import type { ActorCode, CurrentUser, LegacyRoleCode, AllRoleCode } from '@blood/shared-types';

/** Every auth-related path in one place, so no page hard-codes a string. */
export const AUTH_ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  forbidden: '/403',
} as const;

export type AppLayoutKind = 'donor' | 'staff' | 'admin';

/**
 * Landing path per actor.
 *
 * Phase 2.5 sends every actor to the authenticated home. When Phase 3 adds
 * real dashboards this table is the single place to change — pages read the
 * result and never decide a destination themselves.
 */
const ACTOR_LANDING_PATHS: Readonly<Record<ActorCode, string>> = {
  DONOR: AUTH_ROUTES.home,
  DONATION_STAFF: AUTH_ROUTES.home,
  COORDINATOR: AUTH_ROUTES.home,
  SYSTEM_ADMIN: AUTH_ROUTES.home,
};

/** Legacy role → landing path fallback. */
const LEGACY_LANDING_PATHS: Readonly<Record<LegacyRoleCode, string>> = {
  DONOR: AUTH_ROUTES.home,
  RECEPTION_STAFF: AUTH_ROUTES.home,
  MEDICAL_STAFF: AUTH_ROUTES.home,
  BLOOD_COLLECTION_STAFF: AUTH_ROUTES.home,
  ADMIN: AUTH_ROUTES.home,
};

/** Most-privileged first. Used for layout choice and landing resolution. */
const ACTOR_PRIORITY: readonly ActorCode[] = [
  'SYSTEM_ADMIN',
  'COORDINATOR',
  'DONATION_STAFF',
  'DONOR',
];

/** Legacy roles that map to the staff shell. */
const STAFF_LEGACY_ROLES: readonly LegacyRoleCode[] = [
  'RECEPTION_STAFF',
  'MEDICAL_STAFF',
  'BLOOD_COLLECTION_STAFF',
];

/** Legacy role → layout kind mapping. */
const LEGACY_ROLE_LAYOUT_KIND: Readonly<Record<LegacyRoleCode, AppLayoutKind>> = {
  DONOR: 'donor',
  RECEPTION_STAFF: 'staff',
  MEDICAL_STAFF: 'staff',
  BLOOD_COLLECTION_STAFF: 'staff',
  ADMIN: 'admin',
};

/** Most-privileged first (legacy). Used for layout choice when only legacy roles are present. */
const LEGACY_ROLE_PRIORITY: readonly LegacyRoleCode[] = [
  'ADMIN',
  'BLOOD_COLLECTION_STAFF',
  'MEDICAL_STAFF',
  'RECEPTION_STAFF',
  'DONOR',
];

export const primaryRole = (
  roles: readonly AllRoleCode[] = [],
): AllRoleCode | null => {
  // First check new actor codes
  for (const actor of ACTOR_PRIORITY) {
    if (actor !== 'DONOR' && roles.includes(actor)) return actor;
  }
  // Then check legacy role codes
  for (const role of LEGACY_ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return null;
};

/**
 * Which app shell a user gets: DONOR → donor shell, DONATION_STAFF/legacy staff → staff shell,
 * COORDINATOR → staff shell, SYSTEM_ADMIN → admin shell.
 *
 * NOTE: COORDINATOR uses the staff shell because it operational work (campaign
 * management) rather than full admin privileges. SYSTEM_ADMIN uses the admin shell.
 */
export function resolveLayoutKind(
  roles: readonly AllRoleCode[] | undefined,
): AppLayoutKind {
  const role = primaryRole(roles ?? []);
  if (!role) return 'donor';
  if (role === 'SYSTEM_ADMIN') return 'admin';
  if (role === 'DONOR') return 'donor';
  // DONATION_STAFF and legacy staff roles → staff shell
  if (role === 'DONATION_STAFF') return 'staff';
  if (STAFF_LEGACY_ROLES.includes(role as LegacyRoleCode)) return 'staff';
  if (role === 'ADMIN') return LEGACY_ROLE_LAYOUT_KIND[role];
  // COORDINATOR falls through to staff
  return 'staff';
}

/** Landing path per actor, falling back to legacy role resolution. */
export function resolveLandingPath(user: CurrentUser | null): string {
  const role = primaryRole(user?.roles ?? []);
  if (!role) return user ? AUTH_ROUTES.forbidden : AUTH_ROUTES.login;
  // New actor: all go to home
  if (role === 'DONOR' || role === 'DONATION_STAFF' || role === 'COORDINATOR' || role === 'SYSTEM_ADMIN') return ACTOR_LANDING_PATHS[role];
  // Legacy role
  return LEGACY_LANDING_PATHS[role as LegacyRoleCode];
}

/** Roles that belong to the staff shell (including legacy staff roles and DONATION_STAFF). */
export const STAFF_ROLES: readonly AllRoleCode[] = [
  'DONATION_STAFF',
  ...STAFF_LEGACY_ROLES,
];

/** Legacy roles that map to DONATION_STAFF actor. */
export const LEGACY_STAFF_ROLES: readonly LegacyRoleCode[] = [
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
