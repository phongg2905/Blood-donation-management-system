import {
  ERROR_CODES,
  type CertificateStatus,
  type DonationStatus,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';

/**
 * A certificate is issued only for a COMPLETED donation. PENDING, IN_PROGRESS
 * and STOPPED donations are explicitly rejected — a stopped collection never
 * yields a certificate.
 */
export function assertCanIssueCertificate(status: DonationStatus): void {
  if (status !== 'COMPLETED') {
    throw AppError.conflict(ERROR_CODES.DONATION_NOT_COMPLETED);
  }
}

export function assertCertificateIssuable(
  donationStatus: DonationStatus,
  existingCertificate: { id: string } | null,
): void {
  assertCanIssueCertificate(donationStatus);
  if (existingCertificate) {
    throw AppError.conflict(
      ERROR_CODES.CERTIFICATE_NOT_ALLOWED,
      'Lượt hiến máu này đã có chứng nhận',
    );
  }
}

export function assertCanRevokeCertificate(status: CertificateStatus): void {
  if (status === 'REVOKED') {
    throw AppError.conflict(ERROR_CODES.CERTIFICATE_ALREADY_REVOKED);
  }
}
