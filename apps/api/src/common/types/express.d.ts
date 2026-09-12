import type { RoleCode } from '@blood/shared-types';
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; roles: RoleCode[] };
    }
  }
}
export {};
