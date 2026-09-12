import type {
  DonationStatus,
  RegistrationStatus,
  ScreeningStatus,
} from '@prisma/client';
import { AppError } from '../errors/app.error';

export function assertCanCheckIn(status: RegistrationStatus): void {
  if (status !== 'SCHEDULED' && status !== 'CONFIRMED') {
    throw new AppError(
      'Only a scheduled or confirmed registration can check in',
      409,
    );
  }
}

export function assertCanScreen(checkInId: string | null | undefined): void {
  if (!checkInId)
    throw new AppError('Check-in is required before screening', 409);
}

export function assertCanDonate(status: ScreeningStatus): void {
  if (status !== 'ELIGIBLE')
    throw new AppError('Eligible screening is required', 409);
}

export function assertCanIssueCertificate(status: DonationStatus): void {
  if (status !== 'COMPLETED')
    throw new AppError('Completed donation is required', 409);
}
