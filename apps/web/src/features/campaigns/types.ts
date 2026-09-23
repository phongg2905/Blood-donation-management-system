import type {
  CampaignStatus,
  PaginationMeta,
  RoleCode,
} from '@blood/shared-types';

/** FE models until Phase 3 response DTOs are published. Dates are UTC ISO. */
export interface CampaignInput {
  name: string;
  location: string;
  description: string | null;
  organizerName: string | null;
  contactPhone: string | null;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  targetDonors: number | null;
  targetBloodVolumeMl: number | null;
}
export interface Campaign extends CampaignInput {
  id: string;
  status: CampaignStatus;
}
export interface SlotInput {
  startsAt: string;
  endsAt: string;
  capacity: number;
  label: string | null;
}
export interface TimeSlot extends SlotInput {
  id: string;
  campaignId: string;
  isActive: boolean;
}
// Prisma CampaignAssignment; not currently exported by shared-types.
export const ASSIGNMENTS = {
  CHECK_IN: 'Tiếp nhận',
  SCREENING: 'Sàng lọc',
  COLLECTION: 'Lấy máu',
  SUPPORT: 'Hỗ trợ',
} as const;
export type Assignment = keyof typeof ASSIGNMENTS;
export interface StaffCandidate {
  id: string;
  fullName: string;
  email: string;
  roles: RoleCode[];
}
export interface CampaignStaff {
  id: string;
  campaignId: string;
  userId: string;
  assignment: Assignment | null;
  user: StaffCandidate;
}
export interface CampaignQuery {
  search?: string;
  status?: CampaignStatus;
  from?: string;
  to?: string;
  sort?: 'asc' | 'desc';
  page: number;
  limit: number;
}
export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}
export type CampaignAction = 'open' | 'close' | 'cancel';
export interface CampaignRepository {
  list(query: CampaignQuery): Promise<Page<Campaign>>;
  detail(id: string): Promise<Campaign>;
  create(input: CampaignInput): Promise<Campaign>;
  update(id: string, input: CampaignInput): Promise<Campaign>;
  transition(id: string, action: CampaignAction): Promise<Campaign>;
  slots(campaignId: string): Promise<TimeSlot[]>;
  createSlot(campaignId: string, input: SlotInput): Promise<TimeSlot>;
  updateSlot(id: string, input: SlotInput): Promise<TimeSlot>;
  deactivateSlot(id: string): Promise<TimeSlot>;
  staff(campaignId: string): Promise<CampaignStaff[]>;
  searchStaff(campaignId: string, search: string): Promise<StaffCandidate[]>;
  assign(
    campaignId: string,
    userId: string,
    assignment: Assignment | null,
  ): Promise<CampaignStaff>;
  unassign(campaignId: string, id: string): Promise<void>;
}
