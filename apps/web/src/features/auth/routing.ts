import type { ActorCode, AllRoleCode, CurrentUser } from '@blood/shared-types';
import { ACTOR_CODES, LEGACY_TO_ACTOR } from '@blood/shared-types';

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

/** Most-privileged first. Used for layout choice and landing resolution. */
const ACTOR_PRIORITY: readonly ActorCode[] = [
  'SYSTEM_ADMIN',
  'COORDINATOR',
  'DONATION_STAFF',
  'DONOR',
];

/**
 * The API can still deliver a legacy role code for a session issued before the
 * four-actor migration — `CurrentUser.roles` is typed `AllRoleCode[]`, so both
 * generations are accepted at the boundary. Fold every legacy code into its
 * actor here so the rest of the app only ever reasons about actors.
 */
const isActorCode = (role: AllRoleCode): role is ActorCode =>
  (ACTOR_CODES as readonly string[]).includes(role);

const toActor = (role: AllRoleCode): ActorCode =>
  isActorCode(role) ? role : LEGACY_TO_ACTOR[role];

/** The most privileged actor a user holds, or `null` when they hold none. */
export const primaryRole = (
  roles: readonly AllRoleCode[] = [],
): ActorCode | null => {
  for (const actor of ACTOR_PRIORITY) {
    if (roles.some((role) => toActor(role) === actor)) return actor;
  }
  return null;
};

/**
 * Which app shell a user gets: DONOR → donor shell,
 * DONATION_STAFF/COORDINATOR → staff shell, SYSTEM_ADMIN → admin shell.
 *
 * COORDINATOR uses the staff shell because its work is operational (campaign
 * management) rather than full system administration; SYSTEM_ADMIN uses the
 * admin shell.
 */
export function resolveLayoutKind(
  roles: readonly AllRoleCode[] | undefined,
): AppLayoutKind {
  const actor = primaryRole(roles ?? []);
  if (!actor || actor === 'DONOR') return 'donor';
  if (actor === 'SYSTEM_ADMIN') return 'admin';
  return 'staff';
}

/** Landing path per actor, or the forbidden screen for a role-less account. */
export function resolveLandingPath(user: CurrentUser | null): string {
  const actor = primaryRole(user?.roles ?? []);
  if (!actor) return user ? AUTH_ROUTES.forbidden : AUTH_ROUTES.login;
  return ACTOR_LANDING_PATHS[actor];
}

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
