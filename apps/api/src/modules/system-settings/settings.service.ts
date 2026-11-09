import { z } from 'zod';
import { database } from '../../config/database';
import { AppError } from '../../common/errors/app.error';
import { ERROR_CODES, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@blood/shared-types';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';

const DEFAULT_SETTINGS = [
  {
    key: 'site_name',
    value: 'Hệ thống Quản lý Hiến máu',
    description: 'Tên hiển thị chính thức của cổng thông tin hiến máu',
    valueType: 'STRING',
    category: 'Giao diện & Thương hiệu',
  },
  {
    key: 'otp_expiration_minutes',
    value: '5',
    description: 'Thời gian hiệu lực của mã xác thực OTP gửi qua email/SMS (phút)',
    valueType: 'NUMBER',
    category: 'Bảo mật & Xác thực',
  },
  {
    key: 'donor_min_age',
    value: '18',
    description: 'Độ tuổi tối thiểu đủ điều kiện đăng ký tham gia hiến máu',
    valueType: 'NUMBER',
    category: 'Quy định Y tế',
  },
  {
    key: 'donor_min_interval_days',
    value: '84',
    description: 'Khoảng cách tối thiểu giữa 2 lần hiến máu toàn phần (12 tuần / 84 ngày)',
    valueType: 'NUMBER',
    category: 'Quy định Y tế',
  },
  {
    key: 'emergency_alert_enabled',
    value: 'true',
    description: 'Kích hoạt hệ thống phát thông báo khẩn cấp khi kho thiếu hụt máu',
    valueType: 'BOOLEAN',
    category: 'Vận hành khẩn cấp',
  },
  {
    key: 'contact_hotline',
    value: '1900 1234',
    description: 'Đường dây nóng tiếp nhận hỗ trợ người hiến máu và cơ sở y tế',
    valueType: 'STRING',
    category: 'Hỗ trợ & Liên hệ',
  },
];

const updateSettingSchema = z.object({
  value: z.string().min(1, 'Giá trị không được để trống'),
  description: z.string().optional(),
});

export const settingsService = {
  async list() {
    let settings = await database.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    if (settings.length === 0) {
      // Seed default settings if empty
      for (const def of DEFAULT_SETTINGS) {
        await database.systemSetting.upsert({
          where: { key: def.key },
          create: def,
          update: {},
        });
      }
      settings = await database.systemSetting.findMany({
        orderBy: { key: 'asc' },
      });
    }

    return settings.map((s) => ({
      key: s.key,
      value: s.value,
      valueType: s.valueType ?? 'STRING',
      category: s.category ?? 'Hệ thống',
      description: s.description,
      updatedAt: s.updatedAt.toISOString(),
    }));
  },

  async update(key: string, input: unknown, ctx: AuditContext) {
    const data = updateSettingSchema.parse(input);
    const existing = await database.systemSetting.findUnique({
      where: { key },
    });

    let updated;
    if (!existing) {
      const def = DEFAULT_SETTINGS.find((d) => d.key === key);
      updated = await database.systemSetting.create({
        data: {
          key,
          value: data.value,
          description: data.description ?? def?.description,
          valueType: def?.valueType ?? 'STRING',
          category: def?.category ?? 'Hệ thống',
        },
      });
    } else {
      updated = await database.systemSetting.update({
        where: { key },
        data: {
          value: data.value,
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });
    }

    await auditLogService.record(
      {
        ...ctx,
        action: 'SYSTEM_SETTING_UPDATED',
        entityType: 'SystemSetting',
        entityId: key,
        metadata: { key, oldValue: existing?.value, newValue: data.value },
      },
      database,
    );

    return {
      key: updated.key,
      value: updated.value,
      valueType: updated.valueType ?? 'STRING',
      category: updated.category ?? 'Hệ thống',
      description: updated.description,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },
};
