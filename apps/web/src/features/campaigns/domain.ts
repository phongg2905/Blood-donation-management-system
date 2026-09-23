import {
  CAMPAIGN_TRANSITIONS,
  ERROR_MESSAGES,
  type CampaignStatus,
  type ErrorCode,
} from '@blood/shared-types';
import { ApiRequestError } from '@/services/api';
import type { CampaignAction, CampaignInput, SlotInput } from './types';

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Bản nháp',
  OPEN: 'Đang mở đăng ký',
  CLOSED: 'Đã đóng đăng ký',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
};
export const ACTIONS = {
  open: { label: 'Mở đăng ký', status: 'OPEN', permission: 'campaign.open' },
  close: {
    label: 'Đóng đăng ký',
    status: 'CLOSED',
    permission: 'campaign.close',
  },
  cancel: {
    label: 'Hủy đợt hiến',
    status: 'CANCELLED',
    permission: 'campaign.cancel',
  },
} as const;
export const canAct = (status: CampaignStatus, action: CampaignAction) =>
  CAMPAIGN_TRANSITIONS[status].includes(ACTIONS[action].status);
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
export const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function toLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export const toIso = (value: string) =>
  value ? new Date(value).toISOString() : null;
export type FieldErrors = Record<string, string>;
const validDate = (value: string | null) =>
  value !== null && Number.isFinite(Date.parse(value));
const positive = (value: number) =>
  Number.isInteger(value) && value > 0 && value <= 2147483647;
/** Mirrors existing server domain rules; shared-validation currently only exports UUID validators. */
export function validateCampaign(value: CampaignInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!value.name.trim() || value.name.trim().length > 200)
    errors.name = 'Nhập tên đợt hiến từ 1 đến 200 ký tự.';
  if (!value.location.trim() || value.location.trim().length > 500)
    errors.location = 'Nhập địa điểm từ 1 đến 500 ký tự.';
  if (!validDate(value.startsAt)) errors.startsAt = 'Chọn thời gian bắt đầu.';
  if (
    !validDate(value.endsAt) ||
    Date.parse(value.endsAt) <= Date.parse(value.startsAt)
  )
    errors.endsAt = 'Kết thúc phải sau thời gian bắt đầu.';
  if (
    value.registrationOpensAt &&
    (!validDate(value.registrationOpensAt) ||
      Date.parse(value.registrationOpensAt) >= Date.parse(value.startsAt))
  )
    errors.registrationOpensAt = 'Mở đăng ký phải trước khi đợt hiến bắt đầu.';
  if (
    value.registrationClosesAt &&
    (!validDate(value.registrationClosesAt) ||
      Date.parse(value.registrationClosesAt) > Date.parse(value.startsAt))
  )
    errors.registrationClosesAt =
      'Đóng đăng ký phải trước hoặc bằng thời gian bắt đầu.';
  if (
    value.registrationOpensAt &&
    value.registrationClosesAt &&
    Date.parse(value.registrationOpensAt) >=
      Date.parse(value.registrationClosesAt)
  )
    errors.registrationClosesAt = 'Đóng đăng ký phải sau mở đăng ký.';
  for (const field of ['targetDonors', 'targetBloodVolumeMl'] as const)
    if (value[field] !== null && !positive(value[field]))
      errors[field] = 'Nhập số nguyên từ 1 đến 2.147.483.647.';
  return errors;
}
export function validateSlot(
  value: SlotInput,
  campaign: Pick<CampaignInput, 'startsAt' | 'endsAt'>,
): FieldErrors {
  const errors: FieldErrors = {};
  if (
    !validDate(value.startsAt) ||
    Date.parse(value.startsAt) < Date.parse(campaign.startsAt)
  )
    errors.startsAt = 'Bắt đầu phải nằm trong thời gian đợt hiến.';
  if (
    !validDate(value.endsAt) ||
    Date.parse(value.endsAt) <= Date.parse(value.startsAt) ||
    Date.parse(value.endsAt) > Date.parse(campaign.endsAt)
  )
    errors.endsAt = 'Kết thúc phải sau bắt đầu và nằm trong đợt hiến.';
  if (!positive(value.capacity))
    errors.capacity = 'Số chỗ phải là số nguyên từ 1 đến 2.147.483.647.';
  return errors;
}
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
      409: 'Dữ liệu đã thay đổi hoặc bị trùng. Vui lòng tải lại và thử lại.',
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
