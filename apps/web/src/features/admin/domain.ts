import { ERROR_MESSAGES, type ErrorCode } from '@blood/shared-types';
import { ApiRequestError } from '@/services/api';
import type { AdminUserUpdate } from './types';

export type FieldErrors = Record<string, string>;

export const formatDateTime = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';

export const formatNumber = (value: number): string =>
  value.toLocaleString('vi-VN');

/** Human labels for the audit actions the backend records. */
export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  USER_CREATED: 'Tạo người dùng',
  USER_UPDATED: 'Cập nhật người dùng',
  USER_DEACTIVATED: 'Vô hiệu hoá người dùng',
  ROLE_ASSIGNED: 'Gán vai trò',
  ROLE_REMOVED: 'Gỡ vai trò',
  CAMPAIGN_CREATED: 'Tạo đợt hiến',
  CAMPAIGN_UPDATED: 'Cập nhật đợt hiến',
  CAMPAIGN_OPENED: 'Mở đăng ký đợt hiến',
  CAMPAIGN_CLOSED: 'Đóng đăng ký đợt hiến',
  CAMPAIGN_CANCELLED: 'Huỷ đợt hiến',
  REGISTRATION_CREATED: 'Tạo đăng ký',
  REGISTRATION_RESCHEDULED: 'Đổi lịch đăng ký',
  REGISTRATION_CANCELLED: 'Huỷ đăng ký',
  REGISTRATION_CHECKED_IN: 'Check-in người hiến',
  REGISTRATION_NO_SHOW: 'Đánh dấu không đến',
  SCREENING_UPDATED: 'Cập nhật sàng lọc',
  SCREENING_REVIEWED: 'Kết luận sàng lọc',
  DONATION_STARTED: 'Bắt đầu hiến máu',
  DONATION_COMPLETED: 'Hoàn tất hiến máu',
  DONATION_STOPPED: 'Dừng hiến máu',
  BLOOD_BAG_CREATED: 'Tạo túi máu',
  BLOOD_BAG_STATUS_CHANGED: 'Đổi trạng thái túi máu',
  CERTIFICATE_ISSUED: 'Cấp chứng nhận',
  CERTIFICATE_REVOKED: 'Thu hồi chứng nhận',
};

export const auditActionLabel = (action: string): string =>
  AUDIT_ACTION_LABELS[action] ?? action;

/** Setting value types the backend stores as free strings. */
export const SETTING_VALUE_TYPES = [
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'JSON',
] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

/**
 * Rejects values that cannot be read back as their declared type, so a
 * mis-typed setting never leaves the browser in the first place.
 */
export function validateSettingValue(
  value: string,
  valueType: SettingValueType,
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return 'Giá trị không được để trống.';
  if (valueType === 'NUMBER' && !Number.isFinite(Number(trimmed)))
    return 'Giá trị phải là một số.';
  if (
    valueType === 'BOOLEAN' &&
    !['true', 'false'].includes(trimmed.toLowerCase())
  )
    return 'Giá trị phải là true hoặc false.';
  if (valueType === 'JSON') {
    try {
      JSON.parse(trimmed);
    } catch {
      return 'Giá trị phải là JSON hợp lệ.';
    }
  }
  return null;
}

export function validateUserUpdate(value: AdminUserUpdate): FieldErrors {
  const errors: FieldErrors = {};
  if (value.fullName !== undefined) {
    const name = value.fullName.trim();
    if (!name || name.length > 200)
      errors.fullName = 'Nhập họ tên từ 1 đến 200 ký tự.';
  }
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
