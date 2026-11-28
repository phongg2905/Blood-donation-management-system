import { z } from 'zod';
import { parseDomain } from '../../common/helpers/domain-validation';
import type { Prisma } from '@prisma/client';
import type { NotificationChannel, NotificationType } from '@prisma/client';
import { ERROR_CODES } from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import {
  paginationMeta,
  resolvePagination,
} from '../../common/helpers/response';
import { database } from '../../config/database';
import { sendNotificationEmail } from './notification.mailer';
import { notificationRepository as repo } from './notification.repository';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channel?: NotificationChannel;
}

export const notificationService = {
  /**
   * Call inside the caller's own transaction to persist the row atomically
   * with the business write. IN_APP needs no external delivery so it's
   * marked SENT immediately; EMAIL stays PENDING until `dispatch` runs
   * *after* the outer transaction has committed (an SMTP call must never be
   * allowed to roll back a real donation/registration write).
   */
  create: (tx: Prisma.TransactionClient, input: NotifyInput) =>
    repo.create(tx, {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      channel: input.channel ?? 'IN_APP',
      status: (input.channel ?? 'IN_APP') === 'IN_APP' ? 'SENT' : 'PENDING',
      sentAt: (input.channel ?? 'IN_APP') === 'IN_APP' ? new Date() : null,
    }),

  /** Fire-and-forget: call after the outer transaction resolves. Never throws. */
  async dispatch(notification: {
    id: string;
    userId: string;
    channel: string;
    title: string;
    message: string;
  }) {
    if (notification.channel !== 'EMAIL') return;
    try {
      const user = await database.user.findUnique({
        where: { id: notification.userId },
        select: { email: true },
      });
      if (!user) return;
      const ok = await sendNotificationEmail(
        user.email,
        notification.title,
        notification.message,
      );
      await (ok
        ? repo.markSent(notification.id)
        : repo.markFailed(notification.id));
    } catch (error) {
      console.error('Notification dispatch failed', error);
      await repo.markFailed(notification.id).catch(() => undefined);
    }
  },

  async list(userId: string, input: unknown) {
    const query = parseDomain(
      z.object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),
      }),
      input,
    );
    const { page, limit, skip, take } = resolvePagination(query);
    const [items, total] = await repo.listByUser(userId, skip, take);
    return { items, meta: paginationMeta(page, limit, total) };
  },

  async markRead(id: string, userId: string) {
    const result = await repo.markRead(id, userId);
    if (result.count === 0)
      throw AppError.notFound(ERROR_CODES.NOTIFICATION_NOT_FOUND);
  },
};
