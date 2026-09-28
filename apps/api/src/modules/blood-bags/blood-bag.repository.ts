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
};
