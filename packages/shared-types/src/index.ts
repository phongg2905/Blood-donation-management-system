/**
 * Phase 1 shared contract.
 *
 * This package is the single source of truth for role codes, permission codes,
 * error codes, API envelopes, status enums and state transitions. Both the API
 * and the web app import it, so contracts cannot drift between them.
 */

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

/** The system uses exactly five roles. Legacy role codes are not supported. */
export const ROLE_CODES = [
  'DONOR',
  'RECEPTION_STAFF',
  'MEDICAL_STAFF',
  'BLOOD_COLLECTION_STAFF',
  'ADMIN',
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_NAMES: Readonly<Record<RoleCode, string>> = {
  DONOR: 'Người hiến máu',
  RECEPTION_STAFF: 'Nhân viên tiếp nhận',
  MEDICAL_STAFF: 'Nhân viên y tế',
  BLOOD_COLLECTION_STAFF: 'Nhân viên lấy máu',
  ADMIN: 'Quản trị viên',
};

/* -------------------------------------------------------------------------- */
/* Permissions                                                                */
/* -------------------------------------------------------------------------- */

export const PERMISSION_CODES = [
  'auth.profile.read',
  'auth.profile.update',

  'campaign.read',
  'campaign.create',
  'campaign.update',
  'campaign.open',
  'campaign.close',
  'campaign.cancel',

  'timeslot.read',
  'timeslot.create',
  'timeslot.update',
  'timeslot.deactivate',

  'campaign_staff.read',
  'campaign_staff.assign',
  'campaign_staff.remove',

  'registration.read',
  'registration.create',
  'registration.reschedule',
  'registration.cancel',
  'registration.checkin',
  'registration.mark_no_show',

  'health_declaration.read',
  'health_declaration.create',
  'health_declaration.update',

  'screening.read',
  'screening.create',
  'screening.update',
  'screening.review',

  'donation.read',
  'donation.start',
  'donation.complete',
  'donation.stop',

  'bloodbag.read',
  'bloodbag.create',
  'bloodbag.update_status',

  'reaction.read',
  'reaction.create',

  'certificate.read',
  'certificate.issue',
  'certificate.revoke',

  'notification.read',
  'notification.manage',

  'user.read',
  'user.manage',

  'role.read',
  'role.manage',

  'permission.read',
  'permission.manage',

  'audit.read',

  'setting.read',
  'setting.manage',

  'report.read',
  'report.export',
] as const;
export type PermissionCode = (typeof PERMISSION_CODES)[number];

/**
 * Role ownership follows the end-user workflow and keeps duties separate:
 * DONOR registers, RECEPTION_STAFF receives/checks in, MEDICAL_STAFF performs
 * pre-donation medicine, BLOOD_COLLECTION_STAFF collects blood and manages bags,
 * ADMIN administers everything.
 *
 * `notification.read` is the only cross-cutting permission granted to every role.
 */
const DONOR_PERMISSIONS = [
  'auth.profile.read',
  'auth.profile.update',
  'campaign.read',
  'timeslot.read',
  'registration.read',
  'registration.create',
  'registration.reschedule',
  'registration.cancel',
  'health_declaration.read',
  'health_declaration.create',
  'health_declaration.update',
  'donation.read',
  'reaction.read',
  'certificate.read',
  'notification.read',
] as const satisfies readonly PermissionCode[];

/** Reception owns arrival: lookup, check-in and no-show. No clinical actions. */
const RECEPTION_STAFF_PERMISSIONS = [
  'auth.profile.read',
  'auth.profile.update',
  'campaign.read',
  'timeslot.read',
  'registration.read',
  'registration.checkin',
  'registration.mark_no_show',
  'health_declaration.read',
  'user.read',
  'notification.read',
] as const satisfies readonly PermissionCode[];

/**
 * Medical staff own pre-donation medicine only: screening and the clinical
 * conclusion. They never start, complete or stop a donation, never handle blood
 * bags, never record post-donation reactions and never issue/revoke certificates.
 */
const MEDICAL_STAFF_PERMISSIONS = [
  'auth.profile.read',
  'auth.profile.update',
  'campaign.read',
  'timeslot.read',
  'registration.read',
  'health_declaration.read',
  'screening.read',
  'screening.create',
  'screening.update',
  'screening.review',
  'donation.read',
  'reaction.read',
  'certificate.read',
  'notification.read',
] as const satisfies readonly PermissionCode[];

/**
 * Collection staff own everything after an ELIGIBLE conclusion: the donation
 * itself, blood bags, post-donation reactions and issuing the certificate.
 * They can read the screening result but never review or conclude it.
 */
const BLOOD_COLLECTION_STAFF_PERMISSIONS = [
  'auth.profile.read',
  'auth.profile.update',
  'campaign.read',
  'timeslot.read',
  'registration.read',
  'screening.read',
  'donation.read',
  'donation.start',
  'donation.complete',
  'donation.stop',
  'bloodbag.read',
  'bloodbag.create',
  'bloodbag.update_status',
  'reaction.read',
  'reaction.create',
  'certificate.read',
  'certificate.issue',
  'notification.read',
] as const satisfies readonly PermissionCode[];

/** ADMIN owns every permission; explicit so the matrix stays auditable. */
export const ROLE_PERMISSIONS: Readonly<
  Record<RoleCode, readonly PermissionCode[]>
> = {
  DONOR: DONOR_PERMISSIONS,
  RECEPTION_STAFF: RECEPTION_STAFF_PERMISSIONS,
  MEDICAL_STAFF: MEDICAL_STAFF_PERMISSIONS,
  BLOOD_COLLECTION_STAFF: BLOOD_COLLECTION_STAFF_PERMISSIONS,
  ADMIN: PERMISSION_CODES,
};

export const isRoleCode = (value: string): value is RoleCode =>
  (ROLE_CODES as readonly string[]).includes(value);

export const isPermissionCode = (value: string): value is PermissionCode =>
  (PERMISSION_CODES as readonly string[]).includes(value);

/* -------------------------------------------------------------------------- */
/* Status enums                                                               */
/* -------------------------------------------------------------------------- */

export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'OPEN',
  'CLOSED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const REGISTRATION_STATUSES = [
  'PENDING',
  'WAITLISTED',
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const SCREENING_STATUSES = [
  'PENDING',
  'WAITING_REVIEW',
  'ELIGIBLE',
  'INELIGIBLE',
  'DEFERRED',
] as const;
export type ScreeningStatus = (typeof SCREENING_STATUSES)[number];

export const DONATION_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'STOPPED',
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const BLOOD_BAG_STATUSES = [
  'CREATED',
  'COLLECTED',
  'PENDING_TEST',
  'TESTED',
  'ACCEPTED',
  'REJECTED',
  'DISCARDED',
] as const;
export type BloodBagStatus = (typeof BLOOD_BAG_STATUSES)[number];

export const CERTIFICATE_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* State transitions                                                          */
/* -------------------------------------------------------------------------- */

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export function canTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
): boolean {
  return (map[from] ?? []).includes(to);
}

export const TERMINAL_REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export const CAMPAIGN_TRANSITIONS: TransitionMap<CampaignStatus> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const REGISTRATION_TRANSITIONS: TransitionMap<RegistrationStatus> = {
  PENDING: ['SCHEDULED', 'WAITLISTED', 'CANCELLED'],
  WAITLISTED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const SCREENING_TRANSITIONS: TransitionMap<ScreeningStatus> = {
  PENDING: ['WAITING_REVIEW'],
  WAITING_REVIEW: ['ELIGIBLE', 'INELIGIBLE', 'DEFERRED'],
  ELIGIBLE: [],
  INELIGIBLE: [],
  DEFERRED: [],
};

export const DONATION_TRANSITIONS: TransitionMap<DonationStatus> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'STOPPED'],
  COMPLETED: [],
  STOPPED: [],
};

export const BLOOD_BAG_TRANSITIONS: TransitionMap<BloodBagStatus> = {
  CREATED: ['COLLECTED'],
  COLLECTED: ['PENDING_TEST'],
  PENDING_TEST: ['TESTED'],
  TESTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: ['DISCARDED'],
  DISCARDED: [],
};

/** Statuses that must never receive new registrations. */
export const CAMPAIGN_STATUSES_ACCEPTING_REGISTRATION: readonly CampaignStatus[] =
  ['OPEN'];

/** Statuses whose business fields are frozen. */
export const CAMPAIGN_STATUSES_FROZEN: readonly CampaignStatus[] = [
  'COMPLETED',
];

/* -------------------------------------------------------------------------- */
/* Units and measurement catalogue                                            */
/* -------------------------------------------------------------------------- */

export const MEASUREMENT_UNITS = {
  volumeMl: 'ml',
  weightKg: 'kg',
  temperatureC: '°C',
  systolicBp: 'mmHg',
  diastolicBp: 'mmHg',
  pulse: 'bpm',
  hemoglobin: 'g/dL',
} as const;

export interface ScreeningTestDefinition {
  code: string;
  name: string;
  unit: string;
}

/**
 * Fixed catalogue of screening test codes. The API rejects any code that is not
 * listed here, so the frontend cannot invent arbitrary test entries.
 */
export const SCREENING_TEST_CATALOG = [
  {
    code: 'HEMOGLOBIN',
    name: 'Hemoglobin',
    unit: MEASUREMENT_UNITS.hemoglobin,
  },
  { code: 'WEIGHT', name: 'Cân nặng', unit: MEASUREMENT_UNITS.weightKg },
  {
    code: 'TEMPERATURE',
    name: 'Nhiệt độ',
    unit: MEASUREMENT_UNITS.temperatureC,
  },
  {
    code: 'BLOOD_PRESSURE_SYSTOLIC',
    name: 'Huyết áp tâm thu',
    unit: MEASUREMENT_UNITS.systolicBp,
  },
  {
    code: 'BLOOD_PRESSURE_DIASTOLIC',
    name: 'Huyết áp tâm trương',
    unit: MEASUREMENT_UNITS.diastolicBp,
  },
  { code: 'PULSE', name: 'Mạch', unit: MEASUREMENT_UNITS.pulse },
  {
    code: 'INFECTIOUS_DISEASE',
    name: 'Xét nghiệm bệnh truyền nhiễm',
    unit: '',
  },
  { code: 'BLOOD_GROUP', name: 'Nhóm máu', unit: '' },
] as const satisfies readonly ScreeningTestDefinition[];

export const SCREENING_TEST_CODES = SCREENING_TEST_CATALOG.map(
  (test) => test.code,
);
export type ScreeningTestCode = (typeof SCREENING_TEST_CATALOG)[number]['code'];

export const isScreeningTestCode = (
  value: string,
): value is ScreeningTestCode =>
  SCREENING_TEST_CODES.includes(value as ScreeningTestCode);

/* -------------------------------------------------------------------------- */
/* Error codes                                                                */
/* -------------------------------------------------------------------------- */

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUEST_INVALID: 'REQUEST_INVALID',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',

  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',
  AUTH_EMAIL_EXISTS: 'AUTH_EMAIL_EXISTS',
  AUTH_SESSION_INVALID: 'AUTH_SESSION_INVALID',
  AUTH_RESET_TOKEN_INVALID: 'AUTH_RESET_TOKEN_INVALID',

  CAMPAIGN_NOT_FOUND: 'CAMPAIGN_NOT_FOUND',
  CAMPAIGN_NOT_OPEN: 'CAMPAIGN_NOT_OPEN',
  CAMPAIGN_NOT_EDITABLE: 'CAMPAIGN_NOT_EDITABLE',
  CAMPAIGN_INVALID_TRANSITION: 'CAMPAIGN_INVALID_TRANSITION',
  CAMPAIGN_DATE_INVALID: 'CAMPAIGN_DATE_INVALID',
  CAMPAIGN_TARGET_INVALID: 'CAMPAIGN_TARGET_INVALID',

  TIME_SLOT_NOT_FOUND: 'TIME_SLOT_NOT_FOUND',
  TIME_SLOT_FULL: 'TIME_SLOT_FULL',
  TIME_SLOT_INACTIVE: 'TIME_SLOT_INACTIVE',
  TIME_SLOT_OUTSIDE_CAMPAIGN: 'TIME_SLOT_OUTSIDE_CAMPAIGN',

  REGISTRATION_NOT_FOUND: 'REGISTRATION_NOT_FOUND',
  REGISTRATION_DUPLICATE: 'REGISTRATION_DUPLICATE',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  REGISTRATION_WINDOW_CLOSED: 'REGISTRATION_WINDOW_CLOSED',
  REGISTRATION_INVALID_TRANSITION: 'REGISTRATION_INVALID_TRANSITION',
  REGISTRATION_OVERLAP: 'REGISTRATION_OVERLAP',
  REGISTRATION_ALREADY_CHECKED_IN: 'REGISTRATION_ALREADY_CHECKED_IN',
  CHECK_IN_NOT_ALLOWED: 'CHECK_IN_NOT_ALLOWED',

  HEALTH_DECLARATION_REQUIRED: 'HEALTH_DECLARATION_REQUIRED',

  SCREENING_NOT_FOUND: 'SCREENING_NOT_FOUND',
  SCREENING_INVALID_TRANSITION: 'SCREENING_INVALID_TRANSITION',
  SCREENING_NOT_ELIGIBLE: 'SCREENING_NOT_ELIGIBLE',
  SCREENING_REVIEW_REASON_REQUIRED: 'SCREENING_REVIEW_REASON_REQUIRED',
  SCREENING_TEST_CODE_INVALID: 'SCREENING_TEST_CODE_INVALID',
  MEASUREMENT_INVALID: 'MEASUREMENT_INVALID',
  CHECK_IN_REQUIRED: 'CHECK_IN_REQUIRED',

  DONATION_NOT_FOUND: 'DONATION_NOT_FOUND',
  DONATION_INVALID_TRANSITION: 'DONATION_INVALID_TRANSITION',
  DONATION_NOT_COMPLETED: 'DONATION_NOT_COMPLETED',
  DONATION_TIME_INVALID: 'DONATION_TIME_INVALID',
  DONATION_VOLUME_INVALID: 'DONATION_VOLUME_INVALID',
  DONATION_RECONCILIATION_FAILED: 'DONATION_RECONCILIATION_FAILED',

  BLOOD_BAG_INVALID_TRANSITION: 'BLOOD_BAG_INVALID_TRANSITION',

  CERTIFICATE_NOT_ALLOWED: 'CERTIFICATE_NOT_ALLOWED',
  CERTIFICATE_ALREADY_REVOKED: 'CERTIFICATE_ALREADY_REVOKED',

  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Vietnamese, user-facing defaults. The frontend branches on `code`. */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ',
  REQUEST_INVALID: 'Yêu cầu không hợp lệ',
  PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên quá lớn',
  ROUTE_NOT_FOUND: 'Không tìm thấy tài nguyên',
  INTERNAL_ERROR: 'Lỗi hệ thống',
  DATABASE_UNAVAILABLE: 'Không kết nối được cơ sở dữ liệu',
  UNAUTHENTICATED: 'Bạn cần đăng nhập',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',

  AUTH_INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
  AUTH_ACCOUNT_INACTIVE: 'Tài khoản đã bị khoá',
  AUTH_EMAIL_EXISTS: 'Email đã được sử dụng',
  AUTH_SESSION_INVALID: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
  AUTH_RESET_TOKEN_INVALID:
    'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',

  CAMPAIGN_NOT_FOUND: 'Không tìm thấy đợt hiến máu',
  CAMPAIGN_NOT_OPEN: 'Đợt hiến máu chưa mở đăng ký',
  CAMPAIGN_NOT_EDITABLE: 'Không thể sửa đợt hiến máu đã hoàn tất',
  CAMPAIGN_INVALID_TRANSITION:
    'Không thể chuyển đợt hiến máu sang trạng thái này',
  CAMPAIGN_DATE_INVALID: 'Thời gian của đợt hiến máu không hợp lệ',
  CAMPAIGN_TARGET_INVALID: 'Chỉ tiêu của đợt hiến máu phải lớn hơn 0',

  TIME_SLOT_NOT_FOUND: 'Không tìm thấy khung giờ',
  TIME_SLOT_FULL: 'Khung giờ đã đủ số lượng đăng ký',
  TIME_SLOT_INACTIVE: 'Khung giờ đã ngừng sử dụng',
  TIME_SLOT_OUTSIDE_CAMPAIGN:
    'Khung giờ phải nằm trong thời gian của đợt hiến máu',

  REGISTRATION_NOT_FOUND: 'Không tìm thấy đăng ký',
  REGISTRATION_DUPLICATE: 'Bạn đã đăng ký đợt hiến máu này',
  REGISTRATION_CLOSED: 'Đợt hiến máu không nhận đăng ký mới',
  REGISTRATION_WINDOW_CLOSED: 'Ngoài thời gian đăng ký',
  REGISTRATION_INVALID_TRANSITION:
    'Không thể chuyển đăng ký sang trạng thái này',
  REGISTRATION_OVERLAP: 'Bạn đã có lịch trùng thời gian này',
  REGISTRATION_ALREADY_CHECKED_IN: 'Đăng ký đã được check-in',
  CHECK_IN_NOT_ALLOWED:
    'Chỉ đăng ký đã xếp lịch hoặc đã xác nhận mới được check-in',

  HEALTH_DECLARATION_REQUIRED: 'Cần có phiếu khai báo sức khỏe',

  SCREENING_NOT_FOUND: 'Không tìm thấy phiếu sàng lọc',
  SCREENING_INVALID_TRANSITION:
    'Không thể chuyển phiếu sàng lọc sang trạng thái này',
  SCREENING_NOT_ELIGIBLE: 'Chỉ người hiến đủ điều kiện mới được hiến máu',
  SCREENING_REVIEW_REASON_REQUIRED: 'Cần ghi rõ lý do khi kết luận sàng lọc',
  SCREENING_TEST_CODE_INVALID: 'Mã xét nghiệm không nằm trong danh mục',
  MEASUREMENT_INVALID: 'Chỉ số không hợp lệ',
  CHECK_IN_REQUIRED: 'Cần check-in trước khi sàng lọc',

  DONATION_NOT_FOUND: 'Không tìm thấy lượt hiến máu',
  DONATION_INVALID_TRANSITION:
    'Không thể chuyển lượt hiến máu sang trạng thái này',
  DONATION_NOT_COMPLETED:
    'Chỉ lượt hiến máu đã hoàn thành mới được cấp chứng nhận',
  DONATION_TIME_INVALID: 'Mốc thời gian của lượt hiến máu không hợp lệ',
  DONATION_VOLUME_INVALID: 'Thể tích hiến máu không hợp lệ',
  DONATION_RECONCILIATION_FAILED:
    'Thể tích các túi máu không khớp với lượt hiến',

  BLOOD_BAG_INVALID_TRANSITION: 'Không thể chuyển túi máu sang trạng thái này',

  CERTIFICATE_NOT_ALLOWED: 'Không được cấp chứng nhận cho lượt hiến này',
  CERTIFICATE_ALREADY_REVOKED: 'Chứng nhận đã bị thu hồi',

  ROLE_NOT_FOUND: 'Không tìm thấy vai trò',
};

/* -------------------------------------------------------------------------- */
/* Audit actions                                                              */
/* -------------------------------------------------------------------------- */

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',

  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  ROLE_REMOVED: 'ROLE_REMOVED',

  CAMPAIGN_CREATED: 'CAMPAIGN_CREATED',
  CAMPAIGN_UPDATED: 'CAMPAIGN_UPDATED',
  CAMPAIGN_OPENED: 'CAMPAIGN_OPENED',
  CAMPAIGN_CLOSED: 'CAMPAIGN_CLOSED',
  CAMPAIGN_CANCELLED: 'CAMPAIGN_CANCELLED',

  REGISTRATION_CREATED: 'REGISTRATION_CREATED',
  REGISTRATION_RESCHEDULED: 'REGISTRATION_RESCHEDULED',
  REGISTRATION_CANCELLED: 'REGISTRATION_CANCELLED',
  REGISTRATION_CHECKED_IN: 'REGISTRATION_CHECKED_IN',
  REGISTRATION_NO_SHOW: 'REGISTRATION_NO_SHOW',

  SCREENING_UPDATED: 'SCREENING_UPDATED',
  SCREENING_REVIEWED: 'SCREENING_REVIEWED',

  DONATION_STARTED: 'DONATION_STARTED',
  DONATION_COMPLETED: 'DONATION_COMPLETED',
  DONATION_STOPPED: 'DONATION_STOPPED',

  BLOOD_BAG_CREATED: 'BLOOD_BAG_CREATED',
  BLOOD_BAG_STATUS_CHANGED: 'BLOOD_BAG_STATUS_CHANGED',

  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',
  CERTIFICATE_REVOKED: 'CERTIFICATE_REVOKED',
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = {
  USER: 'User',
  CAMPAIGN: 'DonationCampaign',
  TIME_SLOT: 'CampaignTimeSlot',
  CAMPAIGN_STAFF: 'CampaignStaff',
  REGISTRATION: 'Registration',
  HEALTH_DECLARATION: 'HealthDeclaration',
  CHECK_IN: 'CheckIn',
  SCREENING: 'Screening',
  DONATION: 'Donation',
  BLOOD_BAG: 'BloodBag',
  REACTION: 'PostDonationReaction',
  CERTIFICATE: 'Certificate',
  ROLE: 'Role',
  PERMISSION: 'Permission',
  SYSTEM_SETTING: 'SystemSetting',
} as const;
export type AuditEntityType =
  (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

/* -------------------------------------------------------------------------- */
/* API response convention                                                    */
/* -------------------------------------------------------------------------- */

export type ApiFieldErrors = Record<string, string>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  fields: ApiFieldErrors | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiListSuccess<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type DatabaseStatus = 'connected' | 'disconnected';

export interface HealthData {
  status: 'ok';
  database: DatabaseStatus;
  timestamp: string;
}

export type HealthResponse = ApiSuccess<HealthData>;

/* -------------------------------------------------------------------------- */
/* Auth strategy contract (implemented in Phase 2)                            */
/* -------------------------------------------------------------------------- */

/** Shape returned by the current-user endpoint for route/menu guarding. */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

export const DEFAULTS = {
  paginationPage: 1,
  paginationLimit: 10,
  paginationMaxLimit: 100,
} as const;
