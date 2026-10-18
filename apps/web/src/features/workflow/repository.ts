import { createContext, useContext } from 'react';
import type {
  BloodBagStatus,
  CertificateStatus,
  RegistrationStatus,
  ScreeningStatus,
} from '@blood/shared-types';
import { ApiRequestError, apiDelete, apiGet, apiPatch, apiPost } from '@/services/api';
import type {
  BackendBloodType,
  BloodBag,
  BloodBagInput,
  CheckInQuery,
  DonationCertificate,
  DonorHistoryEntry,
  DonorRegistration,
  RegistrationInput,
  ScreeningMeasurements,
  ScreeningNotes,
  ScreeningOutcome,
  ScreeningQueueItem,
  ScreeningRecord,
  WorkflowRepository,
} from './types';

interface BackendRegistrationDto {
  id: string;
  code?: string;
  donorId: string;
  campaignId: string;
  timeSlotId?: string | null;
  status: RegistrationStatus;
  createdAt?: string;
  donor?: {
    phone?: string | null;
    citizenId?: string | null;
    user?: { fullName?: string; phone?: string | null };
  } | null;
  campaign?: {
    name?: string;
    location?: string;
    startsAt?: string;
    endsAt?: string;
  } | null;
  timeSlot?: {
    startsAt?: string;
    endsAt?: string;
  } | null;
  healthDeclaration?: {
    answers?: unknown;
    submittedAt?: string;
    createdAt?: string;
  } | null;
  checkIn?: {
    id: string;
    registrationId: string;
    checkedInAt: string;
    checkedInById?: string | null;
  } | null;
}

interface BackendScreeningDto {
  id: string;
  checkInId?: string;
  status: ScreeningStatus;
  decisionReason?: string | null;
  deferredUntil?: string | null;
  createdAt?: string;
  reviewedAt?: string | null;
  updatedAt?: string | null;
  weightKg?: number | string | null;
  temperatureC?: number | string | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  pulse?: number | null;
  hemoglobin?: number | string | null;
  indicatedVolumeMl?: number | null;
  checkIn?: {
    registrationId?: string;
  } | null;
  tests?: Array<{
    code: string;
    result?: string | null;
  }> | null;
}

interface BackendBloodBagItemDto {
  id: string;
  code: string;
  volumeMl: number;
  bloodType?: BackendBloodType | null;
  status?: BloodBagStatus;
  storageLocation?: string | null;
  createdAt?: string;
}

interface BackendCertificateDto {
  id: string;
  code: string;
  donationId: string;
  issuedAt: string;
  status: CertificateStatus;
  fileUrl?: string | null;
}

interface BackendBloodBagRecordDto {
  bloodBags: BackendBloodBagItemDto[];
  certificate: BackendCertificateDto;
}

/** Maps backend Registration DTO into frontend DonorRegistration model */
export function mapRegistration(
  dto: BackendRegistrationDto,
  fallbackCampaign?: { id: string; name: string; location: string; startsAt: string; endsAt: string },
  fallbackSlot?: { id: string; startsAt: string; endsAt: string },
  fallbackDonorName?: string,
): DonorRegistration {
  return {
    id: dto.id,
    code: dto.code ?? `REG-${dto.id.slice(0, 8).toUpperCase()}`,
    donorId: dto.donorId,
    donorName: dto.donor?.user?.fullName ?? fallbackDonorName ?? '',
    donorPhone: dto.donor?.phone ?? dto.donor?.user?.phone ?? null,
    donorIdentity: dto.donor?.citizenId ?? null,
    campaignId: dto.campaignId,
    campaignName: dto.campaign?.name ?? fallbackCampaign?.name ?? '',
    location: dto.campaign?.location ?? fallbackCampaign?.location ?? '',
    campaignStartsAt: dto.campaign?.startsAt ?? fallbackCampaign?.startsAt ?? '',
    campaignEndsAt: dto.campaign?.endsAt ?? fallbackCampaign?.endsAt ?? '',
    slotId: dto.timeSlotId ?? fallbackSlot?.id ?? '',
    slotStartsAt: dto.timeSlot?.startsAt ?? fallbackSlot?.startsAt ?? '',
    slotEndsAt: dto.timeSlot?.endsAt ?? fallbackSlot?.endsAt ?? '',
    status: dto.status,
    healthDeclaration: dto.healthDeclaration
      ? {
          answers: (dto.healthDeclaration.answers as Record<string, boolean>) ?? {},
          confirmed: true,
          declaredAt: dto.healthDeclaration.submittedAt ?? dto.healthDeclaration.createdAt ?? '',
        }
      : null,
    checkedInAt: dto.checkIn?.checkedInAt ?? null,
    checkIn: dto.checkIn
      ? {
          id: dto.checkIn.id,
          registrationId: dto.checkIn.registrationId,
          checkedInAt: dto.checkIn.checkedInAt,
          checkedInById: dto.checkIn.checkedInById,
        }
      : null,
    createdAt: dto.createdAt ?? new Date().toISOString(),
  };
}

/** Maps backend Screening DTO into frontend ScreeningRecord model */
export function mapScreening(
  dto: BackendScreeningDto,
  fallbackRegistrationId?: string,
  fallbackCheckInId?: string,
): ScreeningRecord {
  const measurements: ScreeningMeasurements = {};
  if (dto.weightKg !== null && dto.weightKg !== undefined) measurements.WEIGHT = Number(dto.weightKg);
  if (dto.temperatureC !== null && dto.temperatureC !== undefined) measurements.TEMPERATURE = Number(dto.temperatureC);
  if (dto.systolicBp !== null && dto.systolicBp !== undefined) measurements.BLOOD_PRESSURE_SYSTOLIC = Number(dto.systolicBp);
  if (dto.diastolicBp !== null && dto.diastolicBp !== undefined) measurements.BLOOD_PRESSURE_DIASTOLIC = Number(dto.diastolicBp);
  if (dto.pulse !== null && dto.pulse !== undefined) measurements.PULSE = Number(dto.pulse);
  if (dto.hemoglobin !== null && dto.hemoglobin !== undefined) measurements.HEMOGLOBIN = Number(dto.hemoglobin);

  let bloodGroup: ScreeningRecord['bloodGroup'] = null;
  let rh: ScreeningRecord['rh'] = null;
  let infectiousTest: ScreeningRecord['infectiousTest'] = null;

  if (Array.isArray(dto.tests)) {
    for (const test of dto.tests) {
      if (test.code === 'INFECTIOUS_DISEASE') {
        infectiousTest = (test.result as ScreeningRecord['infectiousTest']) ?? null;
      }
      if (test.code === 'BLOOD_GROUP' && test.result) {
        if (test.result.includes('+')) {
          rh = 'POSITIVE';
        } else if (test.result.includes('-')) {
          rh = 'NEGATIVE';
        }
        const groupMatch = test.result.replace(/[^ABO]/g, '') as ScreeningRecord['bloodGroup'];
        if (['A', 'B', 'AB', 'O'].includes(groupMatch ?? '')) {
          bloodGroup = groupMatch;
        }
      }
    }
  }

  return {
    id: dto.id,
    registrationId: dto.checkIn?.registrationId ?? fallbackRegistrationId ?? '',
    checkInId: dto.checkInId ?? fallbackCheckInId,
    status: dto.status,
    measurements,
    bloodGroup,
    rh,
    infectiousTest,
    indicatedVolumeMl: dto.indicatedVolumeMl ?? null,
    reason: dto.decisionReason ?? null,
    decisionReason: dto.decisionReason ?? null,
    deferredUntil: dto.deferredUntil ?? null,
    createdAt: dto.createdAt ?? new Date().toISOString(),
    reviewedAt: dto.reviewedAt ?? dto.updatedAt ?? null,
  };
}

export class ApiWorkflowRepository implements WorkflowRepository {
  async availability(): Promise<Record<string, number>> {
    return {};
  }

  async register(input: RegistrationInput): Promise<DonorRegistration> {
    const response = await apiPost<BackendRegistrationDto>('/registrations', {
      campaignId: input.campaign.id,
      timeSlotId: input.slot?.id || undefined,
      healthDeclaration: {
        answers: input.health.answers,
        questionnaireVersion: 'v1.0',
      },
    });
    return mapRegistration(response.data, input.campaign, input.slot, input.donorName);
  }

  async getRegistration(id: string): Promise<DonorRegistration> {
    const response = await apiGet<BackendRegistrationDto>(`/registrations/${encodeURIComponent(id)}`);
    return mapRegistration(response.data);
  }

  async reschedule(id: string, timeSlotId: string): Promise<DonorRegistration> {
    const response = await apiPatch<BackendRegistrationDto>(`/registrations/${encodeURIComponent(id)}/schedule`, {
      timeSlotId,
    });
    return mapRegistration(response.data);
  }

  async cancel(id: string, reason?: string): Promise<DonorRegistration> {
    const response = await apiPost<BackendRegistrationDto>(`/registrations/${encodeURIComponent(id)}/cancel`, {
      reason,
    });
    return mapRegistration(response.data);
  }

  async myRegistrations(): Promise<DonorRegistration[]> {
    try {
      const response = await apiGet<BackendRegistrationDto[]>('/registrations/my');
      return (response.data ?? []).map((item) => mapRegistration(item));
    } catch {
      return [];
    }
  }

  async findRegistrations(query: CheckInQuery): Promise<DonorRegistration[]> {
    const trimmedCode = query.code?.trim();
    if (trimmedCode && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedCode)) {
      try {
        const item = await this.getRegistration(trimmedCode);
        return [item];
      } catch {
        // Fall back to query search
      }
    }

    const searchTerm = trimmedCode || query.identity?.trim() || query.phone?.trim();
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (query.campaignId) params.set('campaignId', query.campaignId);
    params.set('limit', '50');

    try {
      const response = await apiGet<BackendRegistrationDto[]>(`/registrations?${params.toString()}`);
      return (response.data ?? []).map((item) => mapRegistration(item));
    } catch {
      return [];
    }
  }

  async checkIn(registrationId: string): Promise<DonorRegistration> {
    await apiPost<{ id: string; registrationId: string; checkedInAt: string }>(
      `/registrations/${encodeURIComponent(registrationId)}/check-in`,
    );
    return this.getRegistration(registrationId);
  }

  async markNoShow(registrationId: string): Promise<DonorRegistration> {
    const response = await apiPost<BackendRegistrationDto>(
      `/registrations/${encodeURIComponent(registrationId)}/no-show`,
    );
    return mapRegistration(response.data);
  }

  async screeningQueue(campaignId?: string): Promise<ScreeningQueueItem[]> {
    try {
      const response = await apiGet<any[]>('/screenings/queue');
      const list = response.data ?? [];
      return list
        .filter((c) => !campaignId || c.registration?.campaignId === campaignId)
        .map((c) => ({
          registration: mapRegistration(c.registration),
          screening: {
            id: '',
            registrationId: c.registrationId ?? c.registration?.id,
            checkInId: c.id,
            status: 'PENDING',
            measurements: {},
            reason: null,
            createdAt: c.checkedInAt,
            reviewedAt: null,
            bloodGroup: null,
            rh: null,
            infectiousTest: null,
          },
        }));
    } catch {
      return [];
    }
  }

  async screeningFor(registrationId: string): Promise<ScreeningRecord | null> {
    try {
      const reg = await this.getRegistration(registrationId);
      if (reg.checkIn?.id) {
        const response = await apiGet<BackendScreeningDto>(`/screenings/${encodeURIComponent(reg.checkIn.id)}`);
        return mapScreening(response.data, registrationId, reg.checkIn.id);
      }
    } catch {
      // screening not found or checkIn missing
    }
    return null;
  }

  async getScreening(id: string): Promise<ScreeningRecord> {
    const response = await apiGet<BackendScreeningDto>(`/screenings/${encodeURIComponent(id)}`);
    return mapScreening(response.data);
  }

  async saveMeasurements(
    registrationId: string,
    measurements: ScreeningMeasurements,
    notes: ScreeningNotes,
    checkInId?: string,
  ): Promise<ScreeningRecord> {
    let targetCheckInId = checkInId;
    if (!targetCheckInId) {
      const reg = await this.getRegistration(registrationId);
      targetCheckInId = reg.checkIn?.id;
    }
    if (!targetCheckInId) {
      throw new ApiRequestError('CHECK_IN_REQUIRED', 'Lượt đăng ký chưa được check-in', 409);
    }

    const tests: Array<{ code: string; result: string }> = [];
    if (notes.infectiousTest) {
      tests.push({ code: 'INFECTIOUS_DISEASE', result: notes.infectiousTest });
    }
    if (notes.bloodGroup) {
      const bloodGroupStr =
        notes.rh === 'POSITIVE'
          ? `${notes.bloodGroup}+`
          : notes.rh === 'NEGATIVE'
            ? `${notes.bloodGroup}-`
            : notes.bloodGroup;
      tests.push({ code: 'BLOOD_GROUP', result: bloodGroupStr });
    }

    const payload = {
      checkInId: targetCheckInId,
      measurements: {
        weightKg: measurements.WEIGHT ? Number(measurements.WEIGHT) : undefined,
        temperatureC: measurements.TEMPERATURE ? Number(measurements.TEMPERATURE) : undefined,
        systolicBp: measurements.BLOOD_PRESSURE_SYSTOLIC
          ? Math.round(measurements.BLOOD_PRESSURE_SYSTOLIC)
          : undefined,
        diastolicBp: measurements.BLOOD_PRESSURE_DIASTOLIC
          ? Math.round(measurements.BLOOD_PRESSURE_DIASTOLIC)
          : undefined,
        pulse: measurements.PULSE ? Math.round(measurements.PULSE) : undefined,
        hemoglobin: measurements.HEMOGLOBIN ? Number(measurements.HEMOGLOBIN) : undefined,
      },
      tests,
    };

    const response = await apiPost<BackendScreeningDto>('/screenings', payload);
    return mapScreening(response.data, registrationId, targetCheckInId);
  }

  async reviewScreening(
    registrationIdOrScreeningId: string,
    outcome: ScreeningOutcome,
    reason: string | null,
    deferredUntil?: string | null,
    notes?: string | null,
    indicatedVolumeMl?: number | null,
  ): Promise<ScreeningRecord> {
    const payload: {
      status: ScreeningOutcome;
      decisionReason?: string;
      deferredUntil?: string;
      notes?: string;
      indicatedVolumeMl?: number;
    } = {
      status: outcome,
      decisionReason: reason ?? undefined,
      notes: notes ?? undefined,
      indicatedVolumeMl: indicatedVolumeMl ?? undefined,
    };

    if (outcome === 'DEFERRED') {
      if (!reason?.trim()) {
        throw new ApiRequestError(
          'SCREENING_REVIEW_REASON_REQUIRED',
          'Bắt buộc ghi lý do khi tạm hoãn',
          400,
        );
      }
      if (deferredUntil) {
        payload.deferredUntil = deferredUntil;
      }
    }

    const response = await apiPost<BackendScreeningDto>(
      `/screenings/${encodeURIComponent(registrationIdOrScreeningId)}/review`,
      payload,
    );
    return mapScreening(response.data);
  }

  async eligibleForBag(campaignId?: string): Promise<ScreeningQueueItem[]> {
    try {
      const url = `/blood-bags/eligible${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''}`;
      const response = await apiGet<any[]>(url);
      return (response.data ?? []).map((item) => {
        const reg = mapRegistration(item.checkIn.registration);
        const scr = mapScreening(item, item.checkIn.registration.id, item.checkIn.id);
        return { registration: reg, screening: scr };
      });
    } catch {
      return [];
    }
  }

  async bloodBags(campaignId?: string): Promise<BloodBag[]> {
    try {
      const url = `/blood-bags${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}&limit=100` : '?limit=100'}`;
      const response = await apiGet<any[]>(url);
      return (response.data ?? []).map((bag) => {
        const reg = bag.donation?.screening?.checkIn?.registration;
        const bloodTypeStr = bag.bloodType ?? null;
        let bloodGroup: string | null = null;
        if (bloodTypeStr) {
          if (bloodTypeStr.startsWith('A_')) bloodGroup = 'A';
          else if (bloodTypeStr.startsWith('B_')) bloodGroup = 'B';
          else if (bloodTypeStr.startsWith('AB_')) bloodGroup = 'AB';
          else if (bloodTypeStr.startsWith('O_')) bloodGroup = 'O';
        }
        return {
          id: bag.id,
          code: bag.code,
          registrationId: reg?.id ?? '',
          donorId: reg?.donor?.id ?? '',
          donorName: reg?.donor?.user?.fullName ?? '',
          campaignName: reg?.campaign?.name ?? '',
          volumeMl: bag.volumeMl,
          bloodGroup,
          bloodType: bloodTypeStr,
          status: bag.status ?? 'COLLECTED',
          storageLocation: bag.storageLocation ?? null,
          receivedAt: bag.collectedAt ?? bag.createdAt ?? new Date().toISOString(),
          certificateCode: bag.donation?.certificate?.code,
          certificateId: bag.donation?.certificate?.id,
          certificateFileUrl: bag.donation?.certificate?.fileUrl ?? null,
        };
      });
    } catch {
      return [];
    }
  }

  async createBloodBag(input: BloodBagInput): Promise<BloodBag> {
    const screeningId = input.screeningId;
    if (!screeningId) {
      throw new ApiRequestError('REQUEST_INVALID', 'screeningId là bắt buộc', 400);
    }

    const response = await apiPost<BackendBloodBagRecordDto>(
      `/screenings/${encodeURIComponent(screeningId)}/blood-bags`,
      {
        bags: [
          {
            code: input.code.trim(),
            volumeMl: input.volumeMl,
            bloodType: (input.bloodType as BackendBloodType) ?? undefined,
          },
        ],
      },
    );

    const bag = response.data.bloodBags[0];
    if (!bag) {
      throw new ApiRequestError('INTERNAL_ERROR', 'Không tìm thấy túi máu được tạo', 500);
    }
    const cert = response.data.certificate;

    return {
      id: bag.id,
      code: bag.code,
      registrationId: input.registrationId,
      donorId: '',
      donorName: '',
      campaignName: '',
      volumeMl: bag.volumeMl,
      bloodGroup: input.bloodGroup,
      bloodType: bag.bloodType ?? null,
      status: bag.status ?? 'COLLECTED',
      storageLocation: input.storageLocation ?? null,
      receivedAt: bag.createdAt ?? new Date().toISOString(),
      certificateCode: cert?.code,
      certificateId: cert?.id,
      certificateFileUrl: cert?.fileUrl ?? null,
    };
  }

  async updateBloodBag(
    id: string,
    input: Partial<BloodBagInput>,
  ): Promise<BloodBag> {
    const payload = {
      volumeMl: input.volumeMl,
      status: input.status,
      bloodType: input.bloodType,
      storageLocation: input.storageLocation,
      syncDonorProfile: input.syncDonorProfile,
    };
    const response = await apiPatch<BackendBloodBagItemDto>(
      `/blood-bags/${encodeURIComponent(id)}`,
      payload,
    );
    const bag = response.data;
    return {
      id: bag.id,
      code: bag.code,
      donorName: input.donorName ?? '',
      campaignName: input.campaignName ?? '',
      volumeMl: bag.volumeMl,
      bloodGroup: input.bloodGroup ?? null,
      bloodType: bag.bloodType ?? null,
      status: bag.status ?? 'COLLECTED',
      storageLocation: bag.storageLocation ?? input.storageLocation ?? null,
      receivedAt: bag.createdAt ?? new Date().toISOString(),
      notes: input.notes,
    };
  }

  async deleteBloodBag(id: string): Promise<void> {
    await apiDelete(`/blood-bags/${encodeURIComponent(id)}`);
  }

  async certificates(): Promise<DonationCertificate[]> {
    try {
      const response = await apiGet<any[]>('/certificates');
      return (response.data ?? []).map((cert) => {
        const reg = cert.donation?.screening?.checkIn?.registration;
        return {
          id: cert.id,
          code: cert.code,
          donationId: cert.donationId,
          donorId: reg?.donor?.id ?? '',
          donorName: reg?.donor?.user?.fullName ?? '',
          campaignName: reg?.campaign?.name ?? '',
          location: reg?.campaign?.location ?? '',
          donationDate: cert.issuedAt,
          volumeMl: cert.donation?.volumeMl ?? 0,
          bloodGroup: null,
          status: cert.status,
          issuedAt: cert.issuedAt,
          fileUrl: cert.fileUrl ?? null,
        };
      });
    } catch {
      return [];
    }
  }

  async certificate(id: string): Promise<DonationCertificate> {
    const list = await this.certificates();
    const found = list.find((c) => c.id === id || c.code === id);
    if (!found) {
      throw new ApiRequestError('ROUTE_NOT_FOUND', 'Chứng nhận không tồn tại', 404);
    }
    return found;
  }

  async attachCertificateFile(id: string, fileUrl: string): Promise<DonationCertificate> {
    const response = await apiPost<BackendCertificateDto>(
      `/certificates/${encodeURIComponent(id)}/file`,
      { fileUrl },
    );
    const cert = response.data;
    return {
      id: cert.id,
      code: cert.code,
      donationId: cert.donationId,
      donorId: '',
      donorName: '',
      campaignName: '',
      location: '',
      donationDate: cert.issuedAt,
      volumeMl: 0,
      bloodGroup: null,
      status: cert.status,
      issuedAt: cert.issuedAt,
      fileUrl: cert.fileUrl ?? fileUrl,
    };
  }

  async history(donorId?: string): Promise<DonorHistoryEntry[]> {
    try {
      const response = await apiGet<any[]>('/donors/me/history');
      return (response.data ?? []).map((item) => {
        const bag = item.checkIn?.screening?.donation?.bloodBags?.[0];
        const cert = item.checkIn?.screening?.donation?.certificate;
        const rawDate =
          item.date ??
          item.timeSlot?.startsAt ??
          item.campaign?.startsAt ??
          item.createdAt ??
          '';
        const dateStr =
          typeof rawDate === 'string'
            ? rawDate
            : rawDate instanceof Date
            ? rawDate.toISOString()
            : '';
        return {
          id: item.id,
          date: dateStr,
          campaignName: item.campaignName ?? item.campaign?.name ?? '',
          location: item.location ?? item.campaign?.location ?? '',
          volumeMl: item.volumeMl ?? bag?.volumeMl ?? 350,
          bloodGroup: item.bloodGroup ?? bag?.bloodType ?? null,
          status: item.status,
          certificateId: item.certificateId ?? cert?.id ?? null,
        };
      });
    } catch {
      return [];
    }
  }
}

export const mockWorkflowEnabled = false;

const instance: WorkflowRepository = new ApiWorkflowRepository();

export const WorkflowRepositoryContext =
  createContext<WorkflowRepository | null>(null);

export const useWorkflowRepository = (): WorkflowRepository =>
  useContext(WorkflowRepositoryContext) ?? instance;
