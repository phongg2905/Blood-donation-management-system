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
  DonorRegistration,
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

export function parseBackendBloodType(
  bloodType: string | null | undefined,
): { bloodGroup: BloodGroup | ''; rh: RhFactor | '' } {
  if (!bloodType) return { bloodGroup: '', rh: '' };
  if (bloodType.includes('_POSITIVE') || bloodType.includes('+')) {
    const group = bloodType.replace('_POSITIVE', '').replace('+', '').trim() as BloodGroup;
    return { bloodGroup: group, rh: 'POSITIVE' };
  }
  if (bloodType.includes('_NEGATIVE') || bloodType.includes('−') || bloodType.includes('-')) {
    const group = bloodType.replace('_NEGATIVE', '').replace('−', '').replace('-', '').trim() as BloodGroup;
    return { bloodGroup: group, rh: 'NEGATIVE' };
  }
  const clean = bloodType.replace(/[^ABO]/g, '') as BloodGroup;
  return { bloodGroup: clean || '', rh: '' };
}

export function formatBloodTypeDisplay(
  bloodType?: string | null,
  fallbackGroup?: string | null,
  fallbackRh?: string | null,
): string {
  if (bloodType) {
    const parsed = parseBackendBloodType(bloodType);
    if (parsed.bloodGroup) {
      const rhLabel = parsed.rh === 'POSITIVE' ? 'Rh+' : parsed.rh === 'NEGATIVE' ? 'Rh−' : '';
      return rhLabel ? `Nhóm ${parsed.bloodGroup} (${rhLabel})` : `Nhóm ${parsed.bloodGroup}`;
    }
  }
  if (fallbackGroup) {
    const rhLabel = fallbackRh === 'POSITIVE' ? 'Rh+' : fallbackRh === 'NEGATIVE' ? 'Rh−' : '';
    return rhLabel ? `Nhóm ${fallbackGroup} (${rhLabel})` : `Nhóm ${fallbackGroup}`;
  }
  return 'Chờ kết quả Lab';
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
  { code: 'HEMOGLOBIN', label: 'Hemoglobin', unit: 'g/L' },
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

/**
 * Sorts campaigns for on-site clinic stations (Check-in and Screening):
 * Prioritizes campaigns that are currently OPEN / ACTIVE at the very top.
 * 1. ACTIVE window & OPEN status (highest operational priority)
 * 2. ACTIVE window (other statuses)
 * 3. OPEN status (upcoming)
 * 4. UPCOMING window (closest upcoming startsAt first)
 * 5. CLOSED window (most recently closed first)
 */
export function sortCampaignsForOperationalStation<
  T extends {
    campaign: { startsAt: string; endsAt: string; status: string };
    window: OperationalWindow;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const getScore = (item: T) => {
      if (item.window.status === 'ACTIVE' && item.campaign.status === 'OPEN') return 0;
      if (item.window.status === 'ACTIVE') return 1;
      if (item.campaign.status === 'OPEN') return 2;
      if (item.window.status === 'UPCOMING') return 3;
      return 4; // CLOSED
    };

    const scoreA = getScore(a);
    const scoreB = getScore(b);

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    // Both are ACTIVE/OPEN: sort by startsAt ascending
    if (scoreA <= 2) {
      return new Date(a.campaign.startsAt).getTime() - new Date(b.campaign.startsAt).getTime();
    }

    // Both are UPCOMING: sort by startsAt ascending (earliest upcoming first)
    if (scoreA === 3) {
      return new Date(a.campaign.startsAt).getTime() - new Date(b.campaign.startsAt).getTime();
    }

    // Both are CLOSED: sort by endsAt descending (most recently ended first)
    return new Date(b.campaign.endsAt).getTime() - new Date(a.campaign.endsAt).getTime();
  });
}

/**
 * Sắp xếp người đăng ký tại quầy tiếp nhận (Check-in desk):
 * 1. ƯU TIÊN CAO NHẤT: Người chưa check-in (`!checkedInAt`) luôn đứng trước người đã check-in.
 * 2. Trong nhóm Chưa check-in:
 *    - Đơn có thể tiếp nhận (`SCHEDULED`, `CONFIRMED`) đứng trước đơn hủy/vắng (`CANCELLED`, `NO_SHOW`).
 *    - Ưu tiên theo ca hiến sớm (`slotStartsAt` tăng dần).
 *    - Cùng ca hiến: Xếp theo thời gian đăng ký (`createdAt` tăng dần).
 * 3. Trong nhóm Đã check-in:
 *    - Xếp theo thời gian check-in gần nhất (`checkedInAt` giảm dần).
 */
export function sortRegistrationsForCheckIn(items: DonorRegistration[]): DonorRegistration[] {
  return [...items].sort((a, b) => {
    const aCheckedIn = Boolean(a.checkedInAt);
    const bCheckedIn = Boolean(b.checkedInAt);

    // 1. Người chưa check-in luôn đứng trước người đã check-in
    if (!aCheckedIn && bCheckedIn) return -1;
    if (aCheckedIn && !bCheckedIn) return 1;

    // 2. Cả hai chưa check-in
    if (!aCheckedIn && !bCheckedIn) {
      const aEligible = a.status === 'SCHEDULED' || a.status === 'CONFIRMED';
      const bEligible = b.status === 'SCHEDULED' || b.status === 'CONFIRMED';
      if (aEligible && !bEligible) return -1;
      if (!aEligible && bEligible) return 1;

      // Ca hiến sớm hơn xếp trước
      if (a.slotStartsAt && b.slotStartsAt) {
        const slotDiff = new Date(a.slotStartsAt).getTime() - new Date(b.slotStartsAt).getTime();
        if (slotDiff !== 0) return slotDiff;
      } else if (a.slotStartsAt) {
        return -1;
      } else if (b.slotStartsAt) {
        return 1;
      }

      // Cùng ca hoặc không có slot: người đăng ký trước được phục vụ trước
      if (a.createdAt && b.createdAt) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return a.code.localeCompare(b.code);
    }

    // 3. Cả hai đã check-in: người vừa check-in gần nhất đứng đầu nhóm đã check-in
    if (a.checkedInAt && b.checkedInAt) {
      return new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime();
    }

    return 0;
  });
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
    const raw = values[field.code]?.trim().replace(',', '.') ?? '';
    if (!raw) {
      errors[field.code] = 'Nhập chỉ số.';
      continue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      errors[field.code] = 'Chỉ số phải là số lớn hơn 0.';
      continue;
    }

    if (field.code === 'WEIGHT' && (parsed < 30 || parsed > 250)) {
      errors.WEIGHT = 'Cân nặng từ 30 đến 250 kg.';
    }
    if (field.code === 'TEMPERATURE' && (parsed < 34 || parsed > 43)) {
      errors.TEMPERATURE = 'Nhiệt độ từ 34 đến 43 °C.';
    }
    if (field.code === 'PULSE' && (parsed < 40 || parsed > 200)) {
      errors.PULSE = 'Mạch từ 40 đến 200 lần/phút.';
    }
    if (field.code === 'BLOOD_PRESSURE_SYSTOLIC' && (parsed < 60 || parsed > 260)) {
      errors.BLOOD_PRESSURE_SYSTOLIC = 'Huyết áp tâm thu từ 60 đến 260 mmHg.';
    }
    if (field.code === 'BLOOD_PRESSURE_DIASTOLIC' && (parsed < 40 || parsed > 160)) {
      errors.BLOOD_PRESSURE_DIASTOLIC = 'Huyết áp tâm trương từ 40 đến 160 mmHg.';
    }
    if (field.code === 'HEMOGLOBIN' && parsed > 250) {
      errors.HEMOGLOBIN = 'Chỉ số Hemoglobin tối đa 250 g/L.';
    }
  }

  const sys = Number(values.BLOOD_PRESSURE_SYSTOLIC?.trim().replace(',', '.'));
  const dia = Number(values.BLOOD_PRESSURE_DIASTOLIC?.trim().replace(',', '.'));
  if (Number.isFinite(sys) && Number.isFinite(dia) && sys > 0 && dia > 0 && sys <= dia) {
    errors.BLOOD_PRESSURE_SYSTOLIC = 'Huyết áp tâm thu phải lớn hơn huyết áp tâm trương.';
  }

  // Blood group and Rh factor are optional: first-time donors or pending tests can leave them unspecified ("Chưa rõ").
  if (notes.bloodGroup && !notes.rh) {
    errors.rh = 'Vui lòng chọn yếu tố Rh cho nhóm máu đã chọn.';
  }
  if (!notes.infectiousTest)
    errors.infectiousTest = 'Chọn kết quả xét nghiệm nhanh.';
  return errors;
}

export function parseMeasurements(
  values: Record<string, string>,
): ScreeningMeasurements {
  const measurements: ScreeningMeasurements = {};
  for (const field of MEASUREMENT_FIELDS) {
    const clean = values[field.code]?.trim().replace(',', '.') ?? '';
    let num = Number(clean);
    if (field.code === 'HEMOGLOBIN' && num > 0 && num <= 30) {
      num = Math.round(num * 10 * 10) / 10;
    }
    measurements[field.code] = num;
  }
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
    const specific =
      (error.code && ERROR_MESSAGES[error.code as ErrorCode]) ||
      (error.message && !error.message.startsWith('HTTP ') ? error.message : null);

    return {
      message:
        specific ??
        generic[error.status] ??
        'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      fields: error.fields ?? {},
    };
  }
  return { message: 'Không thể kết nối. Vui lòng thử lại.', fields: {} };
}
