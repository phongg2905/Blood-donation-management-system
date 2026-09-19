/**
 * Cross-entity workflow guards.
 *
 * Entity rules live with their owning module; this file is the single import
 * point for the end-to-end lifecycle chain
 * registration -> check-in -> screening -> donation -> certificate.
 */
export { assertCanCheckIn } from '../../modules/registrations/registration.validation';
export {
  assertCanScreen,
  assertScreeningEligibleForDonation as assertCanDonate,
} from '../../modules/screenings/screening.validation';
export { assertCanIssueCertificate } from '../../modules/certificates/certificate.validation';
export {
  assertCanStartDonation,
  validateDonationCompletion,
} from '../../modules/donations/donation.validation';
