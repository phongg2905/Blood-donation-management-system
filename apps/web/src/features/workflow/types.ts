import type {
  BloodBagStatus,
  CertificateStatus,
  RegistrationStatus,
  ScreeningStatus,
} from '@blood/shared-types';

/**
 * FE models for the donor workflow (registration → check-in → screening →
 * blood bag → certificate/history).
 *
 * The backend has not published HTTP contracts for these business flows yet,
 * so these are frontend models served by an in-memory mock, exactly like the
 * campaign feature. When the API lands, only the repository implementation
 * changes — pages and components keep consuming these types.
 */

/** One answer per catalogue question: `true` means "yes / có". */
export type HealthAnswers = Readonly<Record<string, boolean>>;

export interface CheckInRecord {
  id: string;
  registrationId: string;
  checkedInAt: string;
  checkedInById?: string | null;
}

export interface HealthDeclaration {
  answers: HealthAnswers;
  confirmed: boolean;
  declaredAt: string;
}

export interface DonorRegistration {
  id: string;
  /** Human-readable appointment code (printed/typed at check-in). */
  code: string;
  donorId: string;
  donorName: string;
  donorPhone: string | null;
  /** CCCD / identity number. Not collected during self-registration yet. */
  donorIdentity: string | null;
  campaignId: string;
  campaignName: string;
  location: string;
  campaignStartsAt: string;
  campaignEndsAt: string;
  slotId: string;
  slotStartsAt: string;
  slotEndsAt: string;
  status: RegistrationStatus;
  healthDeclaration: HealthDeclaration | null;
  checkedInAt: string | null;
  checkIn?: CheckInRecord | null;
  createdAt: string;
}

export interface RegistrationInput {
  donorId: string;
  donorName: string;
  donorPhone: string | null;
  donorIdentity?: string | null;
  campaign: {
    id: string;
    name: string;
    location: string;
    startsAt: string;
    endsAt: string;
  };
  slot: { id: string; startsAt: string; endsAt: string };
  health: { answers: HealthAnswers; confirmed: boolean };
}

/** Live seat count for one campaign time slot. */
export interface SlotAvailability {
  registered: number;
  remaining: number;
}

export interface ScreeningMeasurements {
  [code: string]: number;
}

export type BloodGroup = 'A' | 'B' | 'AB' | 'O';
export type RhFactor = 'POSITIVE' | 'NEGATIVE';
export type QuickTestResult = 'NEGATIVE' | 'POSITIVE';

export type BackendBloodType =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE';

/** Non-numeric screening fields entered alongside the numeric measurements. */
export interface ScreeningNotes {
  bloodGroup: BloodGroup | null;
  rh: RhFactor | null;
  infectiousTest: QuickTestResult | null;
}

export interface ScreeningRecord extends ScreeningNotes {
  id: string;
  registrationId: string;
  checkInId?: string;
  status: ScreeningStatus;
  measurements: ScreeningMeasurements;
  /** Required for INELIGIBLE / DEFERRED. */
  reason: string | null;
  decisionReason?: string | null;
  deferredUntil?: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** A checked-in donor waiting for / going through screening. */
export interface ScreeningQueueItem {
  registration: DonorRegistration;
  screening: ScreeningRecord;
}

export type ScreeningOutcome = 'ELIGIBLE' | 'INELIGIBLE' | 'DEFERRED';

export interface BloodBagInput {
  registrationId: string;
  screeningId?: string;
  code: string;
  volumeMl: number;
  bloodGroup: string | null;
  bloodType?: string | null;
}

export interface BloodBag {
  id: string;
  code: string;
  registrationId: string;
  donorId: string;
  donorName: string;
  campaignName: string;
  volumeMl: number;
  bloodGroup: string | null;
  bloodType?: string | null;
  status: BloodBagStatus;
  receivedAt: string;
  certificateCode?: string;
}

export interface DonationCertificate {
  id: string;
  code: string;
  donationId: string;
  donorId: string;
  donorName: string;
  campaignName: string;
  location: string;
  donationDate: string;
  volumeMl: number;
  bloodGroup: string | null;
  status: CertificateStatus;
  issuedAt: string;
}

export interface DonorHistoryEntry {
  id: string;
  date: string;
  campaignName: string;
  location: string;
  volumeMl: number | null;
  bloodGroup: string | null;
  status: RegistrationStatus;
  certificateId: string | null;
}

/** Lookup used by the clinic check-in desk. At least one field is required. */
export interface CheckInQuery {
  code?: string;
  identity?: string;
  phone?: string;
}

export interface WorkflowRepository {
  /** Registered seat count per slot id (campaign data comes from its own repo). */
  availability(slotIds: readonly string[]): Promise<Record<string, number>>;
  register(input: RegistrationInput): Promise<DonorRegistration>;
  getRegistration?(id: string): Promise<DonorRegistration>;
  reschedule?(id: string, timeSlotId: string): Promise<DonorRegistration>;
  cancel?(id: string, reason?: string): Promise<DonorRegistration>;
  myRegistrations(donorId: string): Promise<DonorRegistration[]>;
  findRegistrations(query: CheckInQuery): Promise<DonorRegistration[]>;
  checkIn(registrationId: string): Promise<DonorRegistration>;
  markNoShow?(registrationId: string): Promise<DonorRegistration>;
  screeningQueue(): Promise<ScreeningQueueItem[]>;
  screeningFor(registrationId: string): Promise<ScreeningRecord | null>;
  getScreening?(id: string): Promise<ScreeningRecord>;
  saveMeasurements(
    registrationId: string,
    measurements: ScreeningMeasurements,
    notes: ScreeningNotes,
    checkInId?: string,
  ): Promise<ScreeningRecord>;
  reviewScreening(
    registrationIdOrScreeningId: string,
    outcome: ScreeningOutcome,
    reason: string | null,
    deferredUntil?: string | null,
    notes?: string | null,
  ): Promise<ScreeningRecord>;
  eligibleForBag(): Promise<ScreeningQueueItem[]>;
  bloodBags(): Promise<BloodBag[]>;
  createBloodBag(input: BloodBagInput): Promise<BloodBag>;
  certificates(donorId: string): Promise<DonationCertificate[]>;
  certificate(id: string): Promise<DonationCertificate>;
  history(donorId: string): Promise<DonorHistoryEntry[]>;
}
