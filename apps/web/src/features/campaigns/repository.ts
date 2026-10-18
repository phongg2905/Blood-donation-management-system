import { createContext, useContext } from 'react';
import type { RoleCode } from '@blood/shared-types';
import { ApiRequestError, apiDelete, apiGet, apiPatch, apiPost } from '@/services/api';
import type {
  Assignment,
  Campaign,
  CampaignAction,
  CampaignInput,
  CampaignQuery,
  CampaignRepository,
  CampaignStaff,
  SlotInput,
  StaffCandidate,
  TimeSlot,
} from './types';

/** Staff endpoints have no published contract. Inject an adapter once agreed. */
export interface StaffAdapter {
  staff: CampaignRepository['staff'];
  searchStaff: CampaignRepository['searchStaff'];
  assign: CampaignRepository['assign'];
  unassign: CampaignRepository['unassign'];
}
const unavailable = (): never => {
  throw new ApiRequestError('ROUTE_NOT_FOUND', '', 503);
};
/** Named mapper boundary: adjust response DTO mapping here when BE publishes it. */
export const mapCampaign = (dto: Campaign): Campaign => ({ ...dto });
export const mapSlot = (dto: TimeSlot): TimeSlot => ({ ...dto });
export class ApiCampaignRepository implements CampaignRepository {
  constructor(private staffAdapter?: StaffAdapter, private enableDirectApi: boolean = false) {}
  async list(query: CampaignQuery) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const response = await apiGet<Campaign[]>(`/campaigns?${params}`);
    if (!response.meta) throw new ApiRequestError('INTERNAL_ERROR', '', 500);
    return { items: response.data.map(mapCampaign), meta: response.meta };
  }
  async detail(id: string) {
    return mapCampaign(
      (await apiGet<Campaign>(`/campaigns/${encodeURIComponent(id)}`)).data,
    );
  }
  async create(input: CampaignInput) {
    return mapCampaign((await apiPost<Campaign>('/campaigns', input)).data);
  }
  async update(id: string, input: CampaignInput) {
    return mapCampaign(
      (await apiPatch<Campaign>(`/campaigns/${encodeURIComponent(id)}`, input))
        .data,
    );
  }
  async transition(id: string, action: CampaignAction) {
    return mapCampaign(
      (
        await apiPost<Campaign>(
          `/campaigns/${encodeURIComponent(id)}/${action}`,
        )
      ).data,
    );
  }
  async slots(id: string) {
    return (
      await apiGet<TimeSlot[]>(
        `/campaigns/${encodeURIComponent(id)}/time-slots`,
      )
    ).data.map(mapSlot);
  }
  async createSlot(id: string, input: SlotInput) {
    return mapSlot(
      (
        await apiPost<TimeSlot>(
          `/campaigns/${encodeURIComponent(id)}/time-slots`,
          input,
        )
      ).data,
    );
  }
  async updateSlot(id: string, input: SlotInput) {
    return mapSlot(
      (await apiPatch<TimeSlot>(`/time-slots/${encodeURIComponent(id)}`, input))
        .data,
    );
  }
  async deactivateSlot(id: string) {
    return mapSlot(
      (
        await apiPost<TimeSlot>(
          `/time-slots/${encodeURIComponent(id)}/deactivate`,
        )
      ).data,
    );
  }
  async staff(id: string): Promise<CampaignStaff[]> {
    if (this.staffAdapter) return this.staffAdapter.staff(id);
    if (!this.enableDirectApi) return unavailable();
    return (await apiGet<CampaignStaff[]>(`/campaigns/${encodeURIComponent(id)}/staff`)).data;
  }
  async searchStaff(id: string, search: string): Promise<StaffCandidate[]> {
    if (this.staffAdapter) return this.staffAdapter.searchStaff(id, search);
    try {
      const response = await apiGet<{ id: string; fullName: string; email: string; roles: Array<{ role: { code: string } }> }[]>(
        `/users?${search ? `search=${encodeURIComponent(search)}` : ''}`,
      );
      return response.data.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roles: (user.roles ?? []).map((r) => (r.role?.code ?? 'DONATION_STAFF') as RoleCode),
      }));
    } catch {
      return [];
    }
  }
  async assign(
    id: string,
    userId: string,
    assignment: Assignment | null,
  ): Promise<CampaignStaff> {
    if (this.staffAdapter) return this.staffAdapter.assign(id, userId, assignment);
    return (
      await apiPost<CampaignStaff>(`/campaigns/${encodeURIComponent(id)}/staff`, {
        userId,
        assignment,
      })
    ).data;
  }
  async unassign(id: string, assignmentId: string): Promise<void> {
    if (this.staffAdapter) return this.staffAdapter.unassign(id, assignmentId);
    await apiDelete(
      `/campaigns/${encodeURIComponent(id)}/staff/${encodeURIComponent(assignmentId)}`,
    );
  }
}
export const mockCampaignsEnabled = false;
const instance: CampaignRepository = new ApiCampaignRepository(undefined, true);

export const CampaignRepositoryContext =
  createContext<CampaignRepository | null>(null);
export const useCampaignRepository = () =>
  useContext(CampaignRepositoryContext) ?? instance;
