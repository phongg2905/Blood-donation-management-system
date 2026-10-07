import { AppError } from '../../common/errors/app.error';
import { donorRepository as repo } from './donor.repository';

export const donorService = {
  async myHistory(userId: string) {
    const donor = await repo.findByUserId(userId);
    if (!donor)
      throw AppError.internal('DonorProfile missing for a DONOR account');
    return repo.history(donor.id);
  },
};
