import { ApiRequestError } from '@/services/api';
import { ACTIONS, canAct, validateCampaign, validateSlot } from './domain';
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

export interface MockOptions {
  latency?: number;
  scenario?: 'success' | 'empty' | 'error';
}
export class MockCampaignRepository implements CampaignRepository {
  private campaigns: Campaign[];
  private timeSlots: TimeSlot[] = [];
  private assignments: CampaignStaff[] = [];
  private candidates: StaffCandidate[] = [
    {
      id: 'staff-1',
      fullName: 'Nguyễn Minh Anh',
      email: 'minhanh@example.test',
      roles: ['DONATION_STAFF'],
    },
    {
      id: 'staff-2',
      fullName: 'Trần Thanh Hà',
      email: 'thanhha@example.test',
      roles: ['DONATION_STAFF'],
    },
    {
      id: 'staff-3',
      fullName: 'Lê Hoàng Nam',
      email: 'hoangnam@example.test',
      roles: ['DONATION_STAFF'],
    },
  ];
  constructor(private options: MockOptions = {}) {
    const day = (offset: number, hour: number) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      date.setHours(hour, 0, 0, 0);
      return date.toISOString();
    };
    this.campaigns =
      options.scenario === 'empty'
        ? []
        : (
            [
              'OPEN',
              'DRAFT',
              'CLOSED',
              'COMPLETED',
              'CANCELLED',
              'OPEN',
              'OPEN',
            ] as const
          ).map((status, index) => ({
            id: `demo-${index + 1}`,
            name: [
              'Ngày hội giọt hồng',
              'Kết nối những trái tim',
              'Sẻ chia sự sống',
              'Một giọt máu, triệu hy vọng',
              'Hành trình nhân ái',
              'Ngày chủ nhật yêu thương',
              'Tiếp nối hy vọng',
            ][index]!,
            location:
              index % 2
                ? 'Nhà văn hóa Thanh niên, TP. Hồ Chí Minh'
                : 'Trung tâm hiến máu nhân đạo, TP. Hồ Chí Minh',
            description:
              'Cùng cộng đồng sẻ chia và tiếp thêm hy vọng. Vui lòng xem kỹ thời gian, địa điểm và các khung giờ của đợt hiến.',
            organizerName: 'Ban tổ chức ngày hội hiến máu',
            contactPhone: null,
            startsAt: day(
              index === 2 || index === 3 ? -10 : index === 5 ? 0 : 7 + index,
              8,
            ),
            endsAt: day(
              index === 2 || index === 3 ? -10 : index === 5 ? 0 : 7 + index,
              16,
            ),
            registrationOpensAt: null,
            registrationClosesAt: null,
            targetDonors: 120,
            targetBloodVolumeMl: null,
            status,
          }));
    const first = this.campaigns[0];
    if (first) {
      this.timeSlots = [0, 1, 2].map((i) => ({
        id: `slot-${i}`,
        campaignId: first.id,
        label: null,
        startsAt: new Date(
          Date.parse(first.startsAt) + i * 3600000,
        ).toISOString(),
        endsAt: new Date(
          Date.parse(first.startsAt) + (i + 1) * 3600000,
        ).toISOString(),
        capacity: 20,
        isActive: i !== 2,
      }));
      this.assignments = [
        {
          id: 'assignment-1',
          campaignId: first.id,
          userId: this.candidates[0]!.id,
          user: this.candidates[0]!,
          assignment: 'CHECK_IN',
        },
      ];
    }
  }
  private async wait() {
    await new Promise((resolve) =>
      setTimeout(resolve, this.options.latency ?? 300),
    );
    if (this.options.scenario === 'error')
      throw new ApiRequestError('INTERNAL_ERROR', '', 500);
  }
  private find(id: string) {
    const value = this.campaigns.find((c) => c.id === id);
    if (!value) throw new ApiRequestError('CAMPAIGN_NOT_FOUND', '', 404);
    return value;
  }
  private slot(id: string) {
    const value = this.timeSlots.find((s) => s.id === id);
    if (!value) throw new ApiRequestError('TIME_SLOT_NOT_FOUND', '', 404);
    return value;
  }
  private validate(fields: Record<string, string>) {
    if (Object.keys(fields).length)
      throw new ApiRequestError('VALIDATION_ERROR', '', 400, fields);
  }
  async list(query: CampaignQuery) {
    await this.wait();
    const boundary = (value: string, end: boolean) =>
      Date.parse(
        value.length === 10
          ? `${value}T${end ? '23:59:59.999' : '00:00:00'}`
          : value,
      );
    const rows = this.campaigns
      .filter(
        (c) =>
          (!query.search ||
            `${c.name} ${c.location}`
              .toLocaleLowerCase('vi')
              .includes(query.search.toLocaleLowerCase('vi'))) &&
          (!query.status || c.status === query.status) &&
          (!query.from ||
            Date.parse(c.startsAt) >= boundary(query.from, false)) &&
          (!query.to || Date.parse(c.startsAt) <= boundary(query.to, true)),
      )
      .sort(
        (a, b) =>
          (Date.parse(a.startsAt) - Date.parse(b.startsAt)) *
          (query.sort === 'desc' ? -1 : 1),
      );
    return structuredClone({
      items: rows.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / query.limit),
      },
    });
  }
  async detail(id: string) {
    await this.wait();
    return structuredClone(this.find(id));
  }
  async create(input: CampaignInput) {
    await this.wait();
    this.validate(validateCampaign(input));
    const result: Campaign = {
      ...input,
      id: crypto.randomUUID(),
      status: 'DRAFT',
    };
    this.campaigns.push(result);
    return structuredClone(result);
  }
  async update(id: string, input: CampaignInput) {
    await this.wait();
    const campaign = this.find(id);
    if (campaign.status === 'COMPLETED')
      throw new ApiRequestError('CAMPAIGN_NOT_EDITABLE', '', 409);
    this.validate(validateCampaign(input));
    Object.assign(campaign, input);
    return structuredClone(campaign);
  }
  async transition(id: string, action: CampaignAction) {
    await this.wait();
    const campaign = this.find(id);
    if (!canAct(campaign.status, action))
      throw new ApiRequestError('CAMPAIGN_INVALID_TRANSITION', '', 409);
    campaign.status = ACTIONS[action].status;
    return structuredClone(campaign);
  }
  async slots(id: string) {
    await this.wait();
    this.find(id);
    return structuredClone(
      this.timeSlots
        .filter((s) => s.campaignId === id)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    );
  }
  async createSlot(id: string, input: SlotInput) {
    await this.wait();
    this.validate(validateSlot(input, this.find(id)));
    const slot = {
      ...input,
      id: crypto.randomUUID(),
      campaignId: id,
      isActive: true,
    };
    this.timeSlots.push(slot);
    return structuredClone(slot);
  }
  async updateSlot(id: string, input: SlotInput) {
    await this.wait();
    const slot = this.slot(id);
    this.validate(validateSlot(input, this.find(slot.campaignId)));
    Object.assign(slot, input);
    return structuredClone(slot);
  }
  async deactivateSlot(id: string) {
    await this.wait();
    const slot = this.slot(id);
    slot.isActive = false;
    return structuredClone(slot);
  }
  async staff(id: string) {
    await this.wait();
    this.find(id);
    return structuredClone(this.assignments.filter((s) => s.campaignId === id));
  }
  async searchStaff(id: string, search: string) {
    await this.wait();
    this.find(id);
    return structuredClone(
      this.candidates.filter(
        (u) =>
          !this.assignments.some(
            (s) => s.campaignId === id && s.userId === u.id,
          ) &&
          `${u.fullName} ${u.email}`
            .toLocaleLowerCase('vi')
            .includes(search.toLocaleLowerCase('vi')),
      ),
    );
  }
  async assign(id: string, userId: string, assignment: Assignment | null) {
    await this.wait();
    this.find(id);
    const user = this.candidates.find((u) => u.id === userId);
    if (!user) throw new ApiRequestError('ROUTE_NOT_FOUND', '', 404);
    if (
      this.assignments.some((s) => s.campaignId === id && s.userId === userId)
    )
      throw new ApiRequestError('REQUEST_INVALID', '', 409);
    const result = {
      id: crypto.randomUUID(),
      campaignId: id,
      userId,
      assignment,
      user,
    };
    this.assignments.push(result);
    return structuredClone(result);
  }
  async unassign(id: string, assignmentId: string) {
    await this.wait();
    this.find(id);
    if (
      !this.assignments.some(
        (s) => s.campaignId === id && s.id === assignmentId,
      )
    )
      throw new ApiRequestError('ROUTE_NOT_FOUND', '', 404);
    this.assignments = this.assignments.filter(
      (s) => s.campaignId !== id || s.id !== assignmentId,
    );
  }
}
