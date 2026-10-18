import { database } from '../../config/database';

export const donorRepository = {
  findByUserId: (userId: string) =>
    database.donorProfile.findUnique({ where: { userId } }),

  history: (donorId: string) =>
    database.registration.findMany({
      where: {
        donorId,
        status: 'COMPLETED',
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            location: true,
            startsAt: true,
            endsAt: true,
          },
        },
        timeSlot: true,
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
