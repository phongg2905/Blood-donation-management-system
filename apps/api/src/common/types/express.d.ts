import type { PermissionCode, RoleCode } from '@blood/shared-types';

declare global {
  namespace Express {
    interface Request {
      /**
       * Populated only by a verified authentication adapter (Phase 2 JWT
       * strategy). Never trust a role or user id supplied in request headers.
       */
      auth?: {
        userId: string;
        roles: RoleCode[];
        permissions: PermissionCode[];
        sessionId?: string;
      };
    }
  }
}
export {};
