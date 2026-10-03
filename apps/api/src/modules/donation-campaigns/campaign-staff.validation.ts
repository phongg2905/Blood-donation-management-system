import { z } from 'zod';
import { parseDomain } from '../../common/helpers/domain-validation';

/**
 * A per-campaign duty tag, not a permission grant — see decisions.md:
 * "CampaignStaff là phân công theo đợt; quyền hệ thống nằm ở RBAC."
 */
const assignmentEnum = z.enum([
  'CHECK_IN',
  'SCREENING',
  'COLLECTION',
  'SUPPORT',
]);

const assignStaffSchema = z.object({
  userId: z.string().uuid(),
  assignment: assignmentEnum.nullish(),
});
export function validateAssignStaff(input: unknown) {
  return parseDomain(assignStaffSchema, input);
}
