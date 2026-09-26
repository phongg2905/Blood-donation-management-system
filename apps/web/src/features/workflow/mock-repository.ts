import { ApiRequestError } from '@/services/api';
import { validateBloodBag } from './domain';
import type {
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

export interface MockWorkflowOptions {
  latency?: number;
}

const isoDay = (offsetDays: number, hour = 8): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const pad = (value: number, size = 4) => String(value).padStart(size, '0');

interface SeedRegistration {
  code: string;
  donorId: string;
  donorName: string;
  donorPhone: string;
  donorIdentity: string;
  status: DonorRegistration['status'];
  checkedIn: boolean;
  screening: ScreeningRecord['status'] | null;
  bag?: { code: string; volumeMl: number; bloodGroup: string };
}

/**
 * In-memory workflow store.
 *
 * Mirrors the campaign mock: same env-selected resolver, same repository
 * interface, no component talks to it directly. Everything resets on reload.
 */
export class MockWorkflowRepository implements WorkflowRepository {
  private readonly latency: number;
  private registrations: DonorRegistration[] = [];
  private screenings = new Map<string, ScreeningRecord>();
  private bags: BloodBag[] = [];
  private certificatesByDonor = new Map<string, DonationCertificate[]>();
  private historyByDonor = new Map<string, DonorHistoryEntry[]>();
  private sequence = 0;

  constructor(options: MockWorkflowOptions = {}) {
    this.latency = options.latency ?? 300;
    this.seed();
  }

  private wait(): Promise<void> {
    return this.latency <= 0
      ? Promise.resolve()
      : new Promise((resolve) => setTimeout(resolve, this.latency));
  }

  private nextCode(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${pad(this.sequence, 5)}`;
  }

  private screeningOf(registrationId: string): ScreeningRecord | undefined {
    return this.screenings.get(registrationId);
  }

  private registration(id: string): DonorRegistration {
    const found = this.registrations.find((item) => item.id === id);
    if (!found) throw new ApiRequestError('REGISTRATION_NOT_FOUND', '', 404);
    return found;
  }

  /** Two demo registrations spread over the seeded campaign so staff have a queue. */
  private seed(): void {
    const campaign = {
      id: 'demo-1',
      name: 'Ngày hội giọt hồng',
      location: 'Nhà văn hóa Thanh Niên, Quận 1',
    };
    const seeds: SeedRegistration[] = [
      {
        code: 'REG-00001',
        donorId: 'seed-donor-1',
        donorName: 'Nguyễn Minh Anh',
        donorPhone: '0901111111',
        donorIdentity: '079203001234',
        status: 'CONFIRMED',
        checkedIn: false,
        screening: null,
      },
      {
        code: 'REG-00002',
        donorId: 'seed-donor-2',
        donorName: 'Trần Thanh Hà',
        donorPhone: '0902222222',
        donorIdentity: '079203002345',
        status: 'SCHEDULED',
        checkedIn: true,
        screening: 'PENDING',
      },
      {
        code: 'REG-00003',
        donorId: 'seed-donor-3',
        donorName: 'Lê Hoàng Nam',
        donorPhone: '0903333333',
        donorIdentity: '079203003456',
        status: 'CONFIRMED',
        checkedIn: true,
        screening: 'WAITING_REVIEW',
      },
      {
        code: 'REG-00004',
        donorId: 'seed-donor-4',
        donorName: 'Phạm Thu Trang',
        donorPhone: '0904444444',
        donorIdentity: '079203004567',
        status: 'CONFIRMED',
        checkedIn: true,
        screening: 'ELIGIBLE',
      },
      {
        code: 'REG-00005',
        donorId: 'seed-donor-5',
        donorName: 'Đỗ Văn Kiên',
        donorPhone: '0905555555',
        donorIdentity: '079203005678',
        status: 'COMPLETED',
        checkedIn: true,
        screening: 'ELIGIBLE',
        bag: { code: 'BAG-00001', volumeMl: 350, bloodGroup: 'O' },
      },
      {
        code: 'REG-00006',
        donorId: 'seed-donor-6',
        donorName: 'Vũ Hoài An',
        donorPhone: '0906666666',
        donorIdentity: '079203006789',
        status: 'SCHEDULED',
        checkedIn: false,
        screening: null,
      },
    ];

    seeds.forEach((seed, index) => {
      const slotStart = isoDay(2, 8 + index);
      const registration: DonorRegistration = {
        id: `seed-reg-${index + 1}`,
        code: seed.code,
        donorId: seed.donorId,
        donorName: seed.donorName,
        donorPhone: seed.donorPhone,
        donorIdentity: seed.donorIdentity,
        campaignId: campaign.id,
        campaignName: campaign.name,
        location: campaign.location,
        campaignStartsAt: isoDay(2, 7),
        campaignEndsAt: isoDay(2, 17),
        slotId: `slot-${index + 1}`,
        slotStartsAt: slotStart,
        slotEndsAt: isoDay(2, 8 + index).replace(':00:00', ':30:00'),
        status: seed.status,
        healthDeclaration: {
          answers: { FEVER: false, INFECTION: false },
          confirmed: true,
          declaredAt: isoDay(-1, 9),
        },
        checkedInAt: seed.checkedIn ? isoDay(0, 8) : null,
        createdAt: isoDay(-1, 9),
      };
      this.registrations.push(registration);
      this.sequence = Math.max(this.sequence, index + 1);
      if (seed.screening)
        this.screenings.set(
          registration.id,
          this.makeScreening(registration.id, seed.screening),
        );
      if (seed.bag) {
        this.bags.push({
          id: `seed-bag-${index + 1}`,
          code: seed.bag.code,
          registrationId: registration.id,
          donorId: registration.donorId,
          donorName: registration.donorName,
          campaignName: registration.campaignName,
          volumeMl: seed.bag.volumeMl,
          bloodGroup: seed.bag.bloodGroup,
          status: 'ACCEPTED',
          receivedAt: isoDay(0, 10),
        });
      }
    });
  }

  private makeScreening(
    registrationId: string,
    status: ScreeningRecord['status'],
  ): ScreeningRecord {
    return {
      id: `seed-screening-${registrationId}`,
      registrationId,
      status,
      measurements:
        status === 'PENDING'
          ? {}
          : {
              BLOOD_PRESSURE_SYSTOLIC: 120,
              BLOOD_PRESSURE_DIASTOLIC: 80,
              PULSE: 78,
              WEIGHT: 62,
              TEMPERATURE: 36.8,
              HEMOGLOBIN: 14,
            },
      bloodGroup: status === 'PENDING' ? null : 'O',
      rh: status === 'PENDING' ? null : 'POSITIVE',
      infectiousTest: status === 'PENDING' ? null : 'NEGATIVE',
      reason: null,
      createdAt: isoDay(0, 8),
      reviewedAt: status === 'WAITING_REVIEW' || status === 'PENDING'
        ? null
        : isoDay(0, 9),
    };
  }

  async availability(
    slotIds: readonly string[],
  ): Promise<Record<string, number>> {
    await this.wait();
    const counts: Record<string, number> = {};
    for (const id of slotIds) counts[id] = 0;
    for (const registration of this.registrations) {
      if (registration.status === 'CANCELLED') continue;
      if (registration.slotId in counts)
        counts[registration.slotId] = (counts[registration.slotId] ?? 0) + 1;
    }
    return counts;
  }

  async register(input: RegistrationInput): Promise<DonorRegistration> {
    await this.wait();
    if (!input.health.confirmed)
      throw new ApiRequestError('HEALTH_DECLARATION_REQUIRED', '', 400);
    const duplicate = this.registrations.some(
      (item) =>
        item.donorId === input.donorId &&
        item.campaignId === input.campaign.id &&
        item.status !== 'CANCELLED',
    );
    if (duplicate) throw new ApiRequestError('REGISTRATION_DUPLICATE', '', 409);

    const registration: DonorRegistration = {
      id: crypto.randomUUID(),
      code: this.nextCode('REG'),
      donorId: input.donorId,
      donorName: input.donorName,
      donorPhone: input.donorPhone,
      donorIdentity: input.donorIdentity ?? null,
      campaignId: input.campaign.id,
      campaignName: input.campaign.name,
      location: input.campaign.location,
      campaignStartsAt: input.campaign.startsAt,
      campaignEndsAt: input.campaign.endsAt,
      slotId: input.slot.id,
      slotStartsAt: input.slot.startsAt,
      slotEndsAt: input.slot.endsAt,
      status: 'CONFIRMED',
      healthDeclaration: {
        answers: input.health.answers,
        confirmed: input.health.confirmed,
        declaredAt: new Date().toISOString(),
      },
      checkedInAt: null,
      createdAt: new Date().toISOString(),
    };
    this.registrations.push(registration);
    return structuredClone(registration);
  }

  async myRegistrations(donorId: string): Promise<DonorRegistration[]> {
    await this.wait();
    return structuredClone(
      this.registrations
        .filter((item) => item.donorId === donorId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
  }

  async findRegistrations(query: CheckInQuery): Promise<DonorRegistration[]> {
    await this.wait();
    const code = query.code?.trim().toLocaleUpperCase('vi');
    const identity = query.identity?.trim();
    const phone = query.phone?.trim();
    const hasQuery = Boolean(code || identity || phone);
    const matches = hasQuery
      ? this.registrations.filter(
          (item) =>
            (code && item.code.toLocaleUpperCase('vi').includes(code)) ||
            (identity && item.donorIdentity?.includes(identity)) ||
            (phone && item.donorPhone?.includes(phone)),
        )
      : this.registrations;
    return structuredClone(
      matches.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
  }

  async checkIn(registrationId: string): Promise<DonorRegistration> {
    await this.wait();
    const registration = this.registration(registrationId);
    if (registration.status !== 'SCHEDULED' && registration.status !== 'CONFIRMED')
      throw new ApiRequestError('CHECK_IN_NOT_ALLOWED', '', 409);
    if (registration.checkedInAt)
      throw new ApiRequestError('REGISTRATION_ALREADY_CHECKED_IN', '', 409);
    registration.checkedInAt = new Date().toISOString();
    if (!this.screenings.has(registration.id))
      this.screenings.set(
        registration.id,
        this.makeScreening(registration.id, 'PENDING'),
      );
    return structuredClone(registration);
  }

  async screeningQueue(): Promise<ScreeningQueueItem[]> {
    await this.wait();
    return structuredClone(this.queueItems());
  }

  private queueItems(): ScreeningQueueItem[] {
    return this.registrations
      .filter((item) => item.checkedInAt && this.screenings.has(item.id))
      .map((registration) => ({
        registration,
        screening: this.screenings.get(registration.id)!,
      }))
      .sort(
        (a, b) =>
          Date.parse(a.registration.checkedInAt ?? a.registration.createdAt) -
          Date.parse(b.registration.checkedInAt ?? b.registration.createdAt),
      );
  }

  async screeningFor(registrationId: string): Promise<ScreeningRecord | null> {
    await this.wait();
    const screening = this.screeningOf(registrationId);
    return screening ? structuredClone(screening) : null;
  }

  async saveMeasurements(
    registrationId: string,
    measurements: ScreeningMeasurements,
    notes: ScreeningNotes,
  ): Promise<ScreeningRecord> {
    await this.wait();
    const registration = this.registration(registrationId);
    if (!registration.checkedInAt)
      throw new ApiRequestError('CHECK_IN_REQUIRED', '', 409);
    const screening = this.screeningOf(registrationId);
    if (!screening) throw new ApiRequestError('SCREENING_NOT_FOUND', '', 404);
    if (screening.status !== 'PENDING' && screening.status !== 'WAITING_REVIEW')
      throw new ApiRequestError('SCREENING_INVALID_TRANSITION', '', 409);
    screening.measurements = { ...measurements };
    screening.bloodGroup = notes.bloodGroup;
    screening.rh = notes.rh;
    screening.infectiousTest = notes.infectiousTest;
    screening.status = 'WAITING_REVIEW';
    return structuredClone(screening);
  }

  async reviewScreening(
    registrationId: string,
    outcome: ScreeningOutcome,
    reason: string | null,
  ): Promise<ScreeningRecord> {
    await this.wait();
    const screening = this.screeningOf(registrationId);
    if (!screening) throw new ApiRequestError('SCREENING_NOT_FOUND', '', 404);
    if (screening.status !== 'WAITING_REVIEW')
      throw new ApiRequestError('SCREENING_INVALID_TRANSITION', '', 409);
    if (outcome !== 'ELIGIBLE' && !reason?.trim())
      throw new ApiRequestError('SCREENING_REVIEW_REASON_REQUIRED', '', 400);
    screening.status = outcome;
    screening.reason = outcome === 'ELIGIBLE' ? null : reason?.trim() ?? null;
    screening.reviewedAt = new Date().toISOString();
    return structuredClone(screening);
  }

  async eligibleForBag(): Promise<ScreeningQueueItem[]> {
    await this.wait();
    return structuredClone(
      this.queueItems().filter((item) => item.screening.status === 'ELIGIBLE'),
    );
  }

  async bloodBags(): Promise<BloodBag[]> {
    await this.wait();
    return structuredClone(
      [...this.bags].sort(
        (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
      ),
    );
  }

  async createBloodBag(input: BloodBagInput): Promise<BloodBag> {
    await this.wait();
    const errors = validateBloodBag(input);
    if (Object.keys(errors).length > 0)
      throw new ApiRequestError('VALIDATION_ERROR', '', 400, errors);
    const registration = this.registration(input.registrationId);
    const screening = this.screeningOf(registration.id);
    if (!screening || screening.status !== 'ELIGIBLE')
      throw new ApiRequestError('SCREENING_NOT_ELIGIBLE', '', 409);
    if (this.bags.some((bag) => bag.code === input.code.trim()))
      throw new ApiRequestError('REQUEST_INVALID', '', 409, {
        code: 'Mã túi máu đã tồn tại.',
      });
    const bag: BloodBag = {
      id: crypto.randomUUID(),
      code: input.code.trim(),
      registrationId: registration.id,
      donorId: registration.donorId,
      donorName: registration.donorName,
      campaignName: registration.campaignName,
      volumeMl: input.volumeMl,
      bloodGroup: input.bloodGroup,
      status: 'COLLECTED',
      receivedAt: new Date().toISOString(),
    };
    this.bags.push(bag);
    registration.status = 'COMPLETED';
    this.issueCertificate(registration, bag);
    return structuredClone(bag);
  }

  /** A recorded bag is what makes a (mock) certificate available to the donor. */
  private issueCertificate(
    registration: DonorRegistration,
    bag: BloodBag,
  ): DonationCertificate {
    const list = this.certificatesByDonor.get(registration.donorId) ?? [];
    const existing = list.find(
      (item) => item.donationId === registration.id,
    );
    if (existing) return existing;
    const certificate: DonationCertificate = {
      id: crypto.randomUUID(),
      code: this.nextCode('CERT'),
      donationId: registration.id,
      donorId: registration.donorId,
      donorName: registration.donorName,
      campaignName: registration.campaignName,
      location: registration.location,
      donationDate: registration.slotStartsAt,
      volumeMl: bag.volumeMl,
      bloodGroup: bag.bloodGroup,
      status: 'ACTIVE',
      issuedAt: new Date().toISOString(),
    };
    list.push(certificate);
    this.certificatesByDonor.set(registration.donorId, list);
    this.appendHistory(registration, certificate);
    return certificate;
  }

  private appendHistory(
    registration: DonorRegistration,
    certificate: DonationCertificate,
  ): void {
    const list = this.historyByDonor.get(registration.donorId) ?? [];
    if (list.some((item) => item.id === registration.id)) return;
    list.push({
      id: registration.id,
      date: certificate.donationDate,
      campaignName: registration.campaignName,
      location: registration.location,
      volumeMl: certificate.volumeMl,
      bloodGroup: certificate.bloodGroup,
      status: 'COMPLETED',
      certificateId: certificate.id,
    });
    this.historyByDonor.set(registration.donorId, list);
  }

  /**
   * Builds a donor's history the first time it is queried.
   *
   * Real in-session donations (a bag recorded by staff) are authoritative. A
   * donor with no such donation yet gets two illustrative past donations so the
   * history/certificate screens have something to show; they are mock data and
   * the pages label them as such.
   */
  private ensureDonorHistory(donorId: string): void {
    if (this.historyByDonor.has(donorId)) return;
    const history = this.bagHistory(donorId);
    const certificates = history.map((entry) =>
      this.certificateFor(donorId, entry),
    );
    if (history.length === 0) {
      const demo = this.demoDonation(donorId, 1, 21);
      const demoOlder = this.demoDonation(donorId, 2, 78);
      history.push(demo.entry, demoOlder.entry);
      certificates.push(demo.certificate, demoOlder.certificate);
    }
    this.historyByDonor.set(donorId, history);
    const existing = this.certificatesByDonor.get(donorId) ?? [];
    this.certificatesByDonor.set(donorId, [...certificates, ...existing]);
  }

  private bagHistory(donorId: string): DonorHistoryEntry[] {
    const entries: DonorHistoryEntry[] = [];
    for (const registration of this.registrations) {
      if (registration.donorId !== donorId) continue;
      const bag = this.bags.find(
        (item) => item.registrationId === registration.id,
      );
      if (!bag) continue;
      const certificate = this.certificateFor(donorId, {
        id: registration.id,
        date: registration.slotStartsAt,
        campaignName: registration.campaignName,
        location: registration.location,
        volumeMl: bag.volumeMl,
        bloodGroup: bag.bloodGroup,
        status: 'COMPLETED',
        certificateId: null,
      });
      entries.push({
        id: registration.id,
        date: certificate.donationDate,
        campaignName: registration.campaignName,
        location: registration.location,
        volumeMl: bag.volumeMl,
        bloodGroup: bag.bloodGroup,
        status: 'COMPLETED',
        certificateId: certificate.id,
      });
    }
    return entries;
  }

  private certificateFor(
    donorId: string,
    entry: DonorHistoryEntry,
  ): DonationCertificate {
    const existing = (this.certificatesByDonor.get(donorId) ?? []).find(
      (item) => item.donationId === entry.id,
    );
    if (existing) return existing;
    const certificate: DonationCertificate = {
      id: crypto.randomUUID(),
      code: this.nextCode('CERT'),
      donationId: entry.id,
      donorId,
      donorName: this.registrations.find((item) => item.id === entry.id)
        ?.donorName ?? 'Người hiến máu',
      campaignName: entry.campaignName,
      location: entry.location,
      donationDate: entry.date,
      volumeMl: entry.volumeMl ?? 350,
      bloodGroup: entry.bloodGroup,
      status: 'ACTIVE',
      issuedAt: entry.date,
    };
    const list = this.certificatesByDonor.get(donorId) ?? [];
    list.push(certificate);
    this.certificatesByDonor.set(donorId, list);
    return certificate;
  }

  private demoDonation(
    donorId: string,
    index: number,
    daysAgo: number,
  ): { entry: DonorHistoryEntry; certificate: DonationCertificate } {
    const date = isoDay(-daysAgo, 9);
    const id = `demo-donation-${donorId}-${index}`;
    const entry: DonorHistoryEntry = {
      id,
      date,
      campaignName: index === 1 ? 'Ngày hội giọt hồng' : 'Sẻ chia sự sống',
      location:
        index === 1 ? 'Nhà văn hóa Thanh Niên, Quận 1' : 'Trung tâm cộng đồng',
      volumeMl: 350,
      bloodGroup: 'O',
      status: 'COMPLETED',
      certificateId: `${id}-cert`,
    };
    const certificate: DonationCertificate = {
      id: `${id}-cert`,
      code: this.nextCode('CERT'),
      donationId: id,
      donorId,
      donorName: 'Người hiến máu',
      campaignName: entry.campaignName,
      location: entry.location,
      donationDate: date,
      volumeMl: 350,
      bloodGroup: 'O',
      status: 'ACTIVE',
      issuedAt: date,
    };
    return { entry, certificate };
  }

  async certificates(donorId: string): Promise<DonationCertificate[]> {
    await this.wait();
    this.ensureDonorHistory(donorId);
    return structuredClone(
      [...(this.certificatesByDonor.get(donorId) ?? [])].sort(
        (a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt),
      ),
    );
  }

  async certificate(id: string): Promise<DonationCertificate> {
    await this.wait();
    for (const list of this.certificatesByDonor.values()) {
      const found = list.find((item) => item.id === id);
      if (found) return structuredClone(found);
    }
    throw new ApiRequestError('ROUTE_NOT_FOUND', '', 404);
  }

  async history(donorId: string): Promise<DonorHistoryEntry[]> {
    await this.wait();
    this.ensureDonorHistory(donorId);
    return structuredClone(
      [...(this.historyByDonor.get(donorId) ?? [])].sort(
        (a, b) => Date.parse(b.date) - Date.parse(a.date),
      ),
    );
  }
}
