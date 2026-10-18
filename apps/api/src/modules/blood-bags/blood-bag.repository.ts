import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const bloodBagRepository = {
  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),

  findScreeningTx: (tx: Prisma.TransactionClient, screeningId: string) =>
    tx.screening.findUnique({
      where: { id: screeningId },
      include: {
        donation: true,
        checkIn: { include: { registration: { include: { donor: true } } } },
      },
    }),

  createDonation: (
    tx: Prisma.TransactionClient,
    data: Prisma.DonationUncheckedCreateInput,
  ) => tx.donation.create({ data }),

  createBags: (
    tx: Prisma.TransactionClient,
    rows: Prisma.BloodBagUncheckedCreateInput[],
  ) => tx.bloodBag.createManyAndReturn({ data: rows }),

  createCertificate: (
    tx: Prisma.TransactionClient,
    data: Prisma.CertificateUncheckedCreateInput,
  ) => tx.certificate.create({ data }),

  findById: (id: string) =>
    database.bloodBag.findUnique({
      where: { id },
      include: {
        donation: {
          include: {
            certificate: true,
            screening: {
              include: {
                checkIn: {
                  include: {
                    registration: {
                      include: {
                        campaign: true,
                        donor: { include: { user: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),

  async list(filter: {
    campaignId?: string;
    status?: string;
    search?: string;
    skip: number;
    take: number;
  }) {
    const where: Prisma.BloodBagWhereInput = {
      ...(filter.status ? { status: filter.status as any } : {}),
      ...(filter.campaignId
        ? {
            donation: {
              screening: {
                checkIn: {
                  registration: { campaignId: filter.campaignId },
                },
              },
            },
          }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: 'insensitive' } },
              {
                donation: {
                  screening: {
                    checkIn: {
                      registration: {
                        donor: {
                          user: {
                            fullName: {
                              contains: filter.search,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const include = {
      donation: {
        include: {
          certificate: true,
          screening: {
            include: {
              checkIn: {
                include: {
                  registration: {
                    include: {
                      campaign: true,
                      donor: { include: { user: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const [items, total] = await Promise.all([
      database.bloodBag.findMany({
        where,
        include,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      database.bloodBag.count({ where }),
    ]);

    return { items, total };
  },

  async listEligibleScreenings(campaignId?: string) {
    const where: Prisma.ScreeningWhereInput = {
      status: 'ELIGIBLE',
      donation: null,
      ...(campaignId
        ? { checkIn: { registration: { campaignId } } }
        : {}),
    };

    return database.screening.findMany({
      where,
      include: {
        tests: true,
        checkIn: {
          include: {
            registration: {
              include: {
                donor: {
                  include: {
                    user: { select: { fullName: true } },
                  },
                },
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
                healthDeclaration: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  update: (id: string, data: Prisma.BloodBagUpdateInput) =>
    database.bloodBag.update({
      where: { id },
      data,
      include: {
        donation: {
          include: {
            certificate: true,
            screening: {
              include: {
                checkIn: {
                  include: {
                    registration: {
                      include: {
                        campaign: true,
                        donor: { include: { user: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),

  delete: (id: string) => database.bloodBag.delete({ where: { id } }),
};
