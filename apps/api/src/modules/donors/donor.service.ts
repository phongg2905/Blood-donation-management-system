import { AppError } from '../../common/errors/app.error';
import { donorRepository as repo } from './donor.repository';

export const donorService = {
  async myHistory(userId: string) {
    const donor = await repo.findByUserId(userId);
    if (!donor)
      throw AppError.internal('DonorProfile missing for a DONOR account');
    const records = await repo.history(donor.id);
    return records.map((r) => {
      const donation = r.checkIn?.screening?.donation;
      const bag = donation?.bloodBags?.[0];
      const cert = r.checkIn?.screening?.donation?.certificate;
      const donationDate =
        donation?.donatedAt?.toISOString() ??
        r.timeSlot?.startsAt?.toISOString() ??
        r.campaign?.startsAt?.toISOString() ??
        r.createdAt.toISOString();
      return {
        id: r.id,
        date: donationDate,
        campaignName: r.campaign?.name ?? '',
        location: r.campaign?.location ?? '',
        volumeMl: donation?.volumeMl ?? null,
        bloodGroup: bag?.bloodType ?? donor.bloodType ?? null,
        status: r.status,
        certificateId: cert?.id ?? null,
      };
    });
  },
};
