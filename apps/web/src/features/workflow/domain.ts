import {
  ERROR_MESSAGES,
  type BloodBagStatus,
  type CertificateStatus,
  type ErrorCode,
  type RegistrationStatus,
  type ScreeningStatus,
} from '@blood/shared-types';
import { ApiRequestError } from '@/services/api';
import type {
  BackendBloodType,
  BloodBagInput,
  HealthAnswers,
  RhFactor,
  ScreeningMeasurements,
  ScreeningNotes,
  BloodGroup,
  QuickTestResult,
} from './types';

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  PENDING: 'Chờ xử lý',
  WAITLISTED: 'Danh sách chờ',
  SCHEDULED: 'Đã xếp lịch',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không đến',
};

export const SCREENING_STATUS_LABELS: Record<ScreeningStatus, string> = {
  PENDING: 'Chờ sàng lọc',
  WAITING_REVIEW: 'Chờ kết luận',
  ELIGIBLE: 'Đủ điều kiện',
  INELIGIBLE: 'Không đủ điều kiện',
  DEFERRED: 'Tạm hoãn',
};

export const BLOOD_BAG_STATUS_LABELS: Record<BloodBagStatus, string> = {
  CREATED: 'Đã tạo',
  COLLECTED: 'Đã thu nhận',
  PENDING_TEST: 'Chờ xét nghiệm',
  TESTED: 'Đã xét nghiệm',
  ACCEPTED: 'Đạt',
  REJECTED: 'Loại',
  DISCARDED: 'Đã hủy',
};

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  ACTIVE: 'Còn hiệu lực',
  REVOKED: 'Đã thu hồi',
};

export const BLOOD_GROUP_OPTIONS: readonly BloodGroup[] = ['A', 'B', 'AB', 'O'];
export const RH_OPTIONS: readonly RhFactor[] = ['POSITIVE', 'NEGATIVE'];
export const QUICK_TEST_OPTIONS: readonly QuickTestResult[] = [
  'NEGATIVE',
  'POSITIVE',
];

export function toBackendBloodType(
  group: BloodGroup | string | null | undefined,
  rh: RhFactor | string | null | undefined,
): BackendBloodType | null {
  if (!group) return null;
  const cleanGroup = group.replace(/[^ABO]/g, '');
  const isPositive = rh === 'POSITIVE' || group.includes('+');
  const factor = isPositive ? 'POSITIVE' : 'NEGATIVE';
  const combined = `${cleanGroup}_${factor}` as BackendBloodType;
  const valid: readonly BackendBloodType[] = [
    'A_POSITIVE',
    'A_NEGATIVE',
    'B_POSITIVE',
    'B_NEGATIVE',
    'AB_POSITIVE',
    'AB_NEGATIVE',
    'O_POSITIVE',
    'O_NEGATIVE',
  ];
  return valid.includes(combined) ? combined : null;
}

/**
 * Health declaration questions shown during registration.
 *
 * The frontend only records the declared answers — it never turns them into an
 * eligibility decision. Screening (done by staff) is the only place that
 * concludes eligibility, so no medical threshold is invented here.
 */
export const HEALTH_QUESTIONS = [
  {
    code: 'FEVER',
    label: 'Trong 24 giờ qua bạn có sốt hoặc mệt mỏi bất thường?',
  },
  {
    code: 'INFECTION',
    label: 'Bạn đang mắc bệnh nhiễm trùng hoặc đang điều trị bằng kháng sinh?',
  },
  {
    code: 'MEDICATION',
    label: 'Bạn đang dùng thuốc điều trị bệnh mạn tính?',
  },
  {
    code: 'RECENT_DONATION',
    label: 'Bạn đã hiến máu trong vòng 3 tháng gần đây?',
  },
  {
    code: 'PREGNANCY',
    label: 'Bạn đang mang thai hoặc đang cho con bú?',
  },
  {
    code: 'SURGERY',
    label: 'Bạn đã phẫu thuật hoặc xăm hình trong 6 tháng gần đây?',
  },
] as const;

export const HEALTH_QUESTION_CODES = HEALTH_QUESTIONS.map(
  (question) => question.code,
);

/** Numeric measurement fields captured during screening. */
export const MEASUREMENT_FIELDS = [
  { code: 'BLOOD_PRESSURE_SYSTOLIC', label: 'Huyết áp tâm thu', unit: 'mmHg' },
  {
    code: 'BLOOD_PRESSURE_DIASTOLIC',
    label: 'Huyết áp tâm trương',
    unit: 'mmHg',
  },
  { code: 'PULSE', label: 'Mạch', unit: 'lần/phút' },
  { code: 'WEIGHT', label: 'Cân nặng', unit: 'kg' },
  { code: 'TEMPERATURE', label: 'Nhiệt độ', unit: '°C' },
  { code: 'HEMOGLOBIN', label: 'Hemoglobin', unit: 'g/dL' },
] as const;

export type MeasurementFieldCode = (typeof MEASUREMENT_FIELDS)[number]['code'];

export type FieldErrors = Record<string, string>;

const formatDateTimeOptions: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

export const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('vi-VN', formatDateTimeOptions).format(new Date(value));

export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
    new Date(value),
  );

export interface OperationalWindow {
  opensAt: Date;
  closesAt: Date;
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSED';
  isOpen: boolean;
  message: string;
}

export const OPERATIONAL_STATUS_SHORT_LABELS: Record<
  'ACTIVE' | 'UPCOMING' | 'CLOSED',
  string
> = {
  ACTIVE: 'Mở',
  UPCOMING: 'Chưa mở',
  CLOSED: 'Đã đóng',
};

/**
 * Calculates the operational window for on-site check-in and medical screening.
 * Per business rules, on-site stations open 30-60m before startsAt and close 30-60m after endsAt.
 * Default early/late buffer is 60 minutes.
 */
export function getOperationalWindow(
  startsAt: string | Date,
  endsAt: string | Date,
  options?: {
    earlyMinutes?: number;
    lateMinutes?: number;
    now?: Date;
  },
): OperationalWindow {
  const earlyMs = (options?.earlyMinutes ?? 60) * 60 * 1000;
  const lateMs = (options?.lateMinutes ?? 60) * 60 * 1000;
  const now = options?.now ?? new Date();

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  const opensAt = new Date(startDate.getTime() - earlyMs);
  const closesAt = new Date(endDate.getTime() + lateMs);

  const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  if (now.getTime() < opensAt.getTime()) {
    return {
      opensAt,
      closesAt,
      status: 'UPCOMING',
      isOpen: false,
      message: `Quầy tiếp nhận & sàng lọc chưa mở. Dự kiến mở lúc ${timeFormatter.format(opensAt)} (sớm 60 phút trước khi bắt đầu).`,
    };
  }

  if (now.getTime() > closesAt.getTime()) {
    return {
      opensAt,
      closesAt,
      status: 'CLOSED',
      isOpen: false,
      message: `Đã kết thúc giờ tác nghiệp tại điểm hiến. Quầy đã đóng lúc ${timeFormatter.format(closesAt)} (muộn 60 phút sau khi kết thúc).`,
    };
  }

  return {
    opensAt,
    closesAt,
    status: 'ACTIVE',
    isOpen: true,
    message: `Đang trong khung giờ tiếp nhận & sàng lọc (${timeFormatter.format(opensAt)} – ${timeFormatter.format(closesAt)}).`,
  };
}

export const formatSlotRange = (startsAt: string, endsAt: string): string => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${time.format(start)} – ${time.format(end)} · ${formatDate(startsAt)}`;
};

export function validateHealthDeclaration(
  answers: HealthAnswers,
  confirmed: boolean,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const question of HEALTH_QUESTIONS)
    if (typeof answers[question.code] !== 'boolean')
      errors[question.code] = 'Vui lòng trả lời câu hỏi này.';
  if (!confirmed)
    errors.confirmed = 'Bạn cần xác nhận thông tin khai báo là đúng sự thật.';
  return errors;
}

/**
 * Only checks that the staff entered valid numbers for the fields they filled
 * in and answered every catalogue field. No clinical threshold is enforced on
 * the client — the staff member makes the eligibility decision.
 */
export function validateScreening(
  values: Record<string, string>,
  notes: ScreeningNotes,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of MEASUREMENT_FIELDS) {
    const raw = values[field.code]?.trim() ?? '';
    if (!raw) {
      errors[field.code] = 'Nhập chỉ số.';
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0)
      errors[field.code] = 'Chỉ số phải là số lớn hơn 0.';
  }
  if (!notes.bloodGroup) errors.bloodGroup = 'Chọn nhóm máu ABO.';
  if (!notes.rh) errors.rh = 'Chọn yếu tố Rh.';
  if (!notes.infectiousTest)
    errors.infectiousTest = 'Chọn kết quả xét nghiệm nhanh.';
  return errors;
}

export function parseMeasurements(
  values: Record<string, string>,
): ScreeningMeasurements {
  const measurements: ScreeningMeasurements = {};
  for (const field of MEASUREMENT_FIELDS)
    measurements[field.code] = Number(values[field.code]);
  return measurements;
}

export function validateBloodBag(input: BloodBagInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.code.trim() || input.code.trim().length > 50)
    errors.code = 'Nhập mã túi máu từ 1 đến 50 ký tự.';
  if (!Number.isInteger(input.volumeMl) || input.volumeMl <= 0)
    errors.volumeMl = 'Thể tích phải là số nguyên lớn hơn 0 (ml).';
  return errors;
}

/** Mirrors the campaign error mapping so feedback copy stays consistent. */
export function describeError(error: unknown): {
  message: string;
  fields: FieldErrors;
} {
  if (error instanceof ApiRequestError) {
    const generic: Record<number, string> = {
      400: 'Vui lòng kiểm tra thông tin đã nhập.',
      401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      403: 'Bạn không có quyền thực hiện thao tác này.',
      404: 'Không tìm thấy dữ liệu. Có thể dữ liệu đã được thay đổi.',
      409: 'Dữ liệu đã thay đổi hoặc không hợp lệ ở bước này.',
      503: 'Chức năng đang được chuẩn bị. Vui lòng thử lại sau.',
    };
    return {
      message:
        generic[error.status] ??
        ERROR_MESSAGES[error.code as ErrorCode] ??
        'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      fields: error.fields ?? {},
    };
  }
  return { message: 'Không thể kết nối. Vui lòng thử lại.', fields: {} };
}
