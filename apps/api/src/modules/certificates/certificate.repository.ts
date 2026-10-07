import type { CertificateStatus, Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const certificateRepository = {
  findById: (id: string) => database.certificate.findUnique({ where: { id } }),
  setFileUrl: (id: string, fileUrl: string) =>
    database.certificate.update({ where: { id }, data: { fileUrl } }),

  revoke: (id: string, reason: string | undefined) =>
    database.certificate.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokeReason: reason ?? null,
      },
    }),

  async list(filter: {
    donorUserId?: string | undefined;
    status?: string | undefined;
    skip: number;
    take: number;
  }) {
    const where: Prisma.CertificateWhereInput = {
      ...(filter.status ? { status: filter.status as CertificateStatus } : {}),
      ...(filter.donorUserId
        ? {
            donation: {
              screening: {
                checkIn: {
                  registration: { donor: { userId: filter.donorUserId } },
                },
              },
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      database.certificate.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { issuedAt: 'desc' },
      }),
      database.certificate.count({ where }),
    ]);
    return { items, total };
  },
};
