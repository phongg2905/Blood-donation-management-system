import { createContext, useContext } from 'react';
import { ApiRequestError, apiGet, apiPatch, apiPost } from '@/services/api';
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
  constructor(private staffAdapter?: StaffAdapter) {}
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
    return this.staffAdapter ? this.staffAdapter.staff(id) : unavailable();
  }
  async searchStaff(id: string, search: string): Promise<StaffCandidate[]> {
    return this.staffAdapter
      ? this.staffAdapter.searchStaff(id, search)
      : unavailable();
  }
  async assign(
    id: string,
    userId: string,
    assignment: Assignment | null,
  ): Promise<CampaignStaff> {
    return this.staffAdapter
      ? this.staffAdapter.assign(id, userId, assignment)
      : unavailable();
  }
  async unassign(id: string, assignmentId: string): Promise<void> {
    return this.staffAdapter
      ? this.staffAdapter.unassign(id, assignmentId)
      : unavailable();
  }
}
export const mockCampaignsEnabled =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_CAMPAIGNS === 'true';
let instance: CampaignRepository = new ApiCampaignRepository();
if (mockCampaignsEnabled) {
  const { MockCampaignRepository } = await import('./mock-repository');
  const scenario = import.meta.env.VITE_CAMPAIGN_MOCK_SCENARIO;
  instance = new MockCampaignRepository({
    scenario:
      scenario === 'empty' || scenario === 'error' ? scenario : 'success',
    latency: Number(import.meta.env.VITE_CAMPAIGN_MOCK_LATENCY) || 300,
  });
}
export const CampaignRepositoryContext =
  createContext<CampaignRepository | null>(null);
export const useCampaignRepository = () =>
  useContext(CampaignRepositoryContext) ?? instance;
