import {
  canTransition,
  type ErrorCode,
  type TransitionMap,
} from '@blood/shared-types';
import { AppError } from '../errors/app.error';

/**
 * Centralized state-transition enforcement. Every status change goes through
 * this helper so transitions are enforced on the backend and stay identical to
 * the map the frontend uses to render allowed actions.
 */
export function assertTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
  code: ErrorCode,
  message?: string,
  fields: Record<string, string> | null = null,
): void {
  if (from === to) return;
  if (!canTransition(map, from, to)) {
    throw AppError.conflict(
      code,
      message ?? `Không thể chuyển trạng thái từ ${from} sang ${to}`,
      fields,
    );
  }
}
