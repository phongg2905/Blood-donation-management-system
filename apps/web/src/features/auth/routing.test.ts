import { describe, expect, it } from 'vitest';
import type { CurrentUser, RoleCode } from '@blood/shared-types';
import {
  AUTH_ROUTES,
  isSafeRedirectPath,
  primaryRole,
  resolveLandingPath,
  resolveLayoutKind,
  resolvePostLoginPath,
  redirectTargetFromState,
  emailFromState,
} from './routing';

const userWith = (roles: RoleCode[]): CurrentUser => ({
  id: 'u1',
  email: 'user@example.local',
  fullName: 'Người Dùng',
  roles,
  permissions: [],
});

describe('primaryRole', () => {
  it('picks the most privileged role', () => {
    expect(primaryRole(['DONOR', 'ADMIN'])).toBe('ADMIN');
    expect(primaryRole(['RECEPTION_STAFF', 'MEDICAL_STAFF'])).toBe(
      'MEDICAL_STAFF',
    );
  });

  it('returns null for no roles', () => {
    expect(primaryRole([])).toBeNull();
  });
});

describe('resolveLayoutKind', () => {
  it('maps DONOR to the donor shell', () => {
    expect(resolveLayoutKind(['DONOR'])).toBe('donor');
  });

  it('maps every staff role to the staff shell', () => {
    expect(resolveLayoutKind(['RECEPTION_STAFF'])).toBe('staff');
    expect(resolveLayoutKind(['MEDICAL_STAFF'])).toBe('staff');
    expect(resolveLayoutKind(['BLOOD_COLLECTION_STAFF'])).toBe('staff');
  });

  it('maps ADMIN to the admin shell', () => {
    expect(resolveLayoutKind(['ADMIN'])).toBe('admin');
  });

  it('prefers the admin shell for a mixed account', () => {
    expect(resolveLayoutKind(['DONOR', 'ADMIN'])).toBe('admin');
  });
});

describe('resolveLandingPath', () => {
  it('sends anonymous users to login', () => {
    expect(resolveLandingPath(null)).toBe(AUTH_ROUTES.login);
  });

  it('sends a user with no roles to 403 rather than looping', () => {
    expect(resolveLandingPath(userWith([]))).toBe(AUTH_ROUTES.forbidden);
  });

  it('lands donor and admin on their home', () => {
    expect(resolveLandingPath(userWith(['DONOR']))).toBe('/profile');
    expect(resolveLandingPath(userWith(['ADMIN']))).toBe('/profile');
  });
});

describe('isSafeRedirectPath', () => {
  it('accepts internal paths', () => {
    expect(isSafeRedirectPath('/profile')).toBe(true);
    expect(isSafeRedirectPath('/profile?tab=security')).toBe(true);
  });

  it('rejects external and protocol-relative targets', () => {
    expect(isSafeRedirectPath('https://evil.example')).toBe(false);
    expect(isSafeRedirectPath('//evil.example')).toBe(false);
    expect(isSafeRedirectPath('profile')).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });

  it('rejects bouncing back into an auth screen', () => {
    expect(isSafeRedirectPath(AUTH_ROUTES.login)).toBe(false);
    expect(isSafeRedirectPath(`${AUTH_ROUTES.register}?step=2`)).toBe(false);
  });
});

describe('resolvePostLoginPath', () => {
  it('honours a safe intended destination', () => {
    expect(resolvePostLoginPath(userWith(['DONOR']), '/profile')).toBe(
      '/profile',
    );
  });

  it('falls back to the role landing page', () => {
    expect(
      resolvePostLoginPath(userWith(['ADMIN']), 'https://evil.example'),
    ).toBe('/profile');
    expect(resolvePostLoginPath(userWith(['DONOR']), undefined)).toBe(
      '/profile',
    );
  });
});

describe('router state helpers', () => {
  it('reads `from` only from an object state', () => {
    expect(redirectTargetFromState({ from: '/profile' })).toBe('/profile');
    expect(redirectTargetFromState(null)).toBeUndefined();
    expect(redirectTargetFromState('nope')).toBeUndefined();
  });

  it('reads a prefilled email', () => {
    expect(emailFromState({ email: 'a@b.local' })).toBe('a@b.local');
    expect(emailFromState({})).toBe('');
    expect(emailFromState(undefined)).toBe('');
  });
});
