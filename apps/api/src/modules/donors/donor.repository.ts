import { database } from '../../config/database';

export const donorRepository = {
  findByUserId: (userId: string) =>
    database.donorProfile.findUnique({ where: { userId } }),

  history: (donorId: string) =>
    database.registration.findMany({
      where: { donorId },
      include: {
        campaign: { select: { id: true, name: true, startsAt: true } },
        checkIn: {
          include: {
            screening: {
              include: {
                donation: {
                  include: { bloodBags: true, certificate: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
};
