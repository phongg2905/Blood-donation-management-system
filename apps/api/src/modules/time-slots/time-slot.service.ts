import { z } from 'zod';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import { timeSlotRepository as repository } from './time-slot.repository';
import { timeSlotSchema, validateTimeSlot } from './time-slot.validation';

// Internal application services only; no new HTTP CRUD endpoints.
export const timeSlotService = {
  async create(input: unknown) {
    const data = parseDomain(timeSlotSchema, input);
    return repository.transaction(async (tx) => {
      const campaign = await repository.campaign(tx, data.campaignId);
      if (!campaign) throw new AppError('Campaign not found', 404);
      return repository.create(tx, validateTimeSlot(data, campaign));
    });
  },
  async schedule(input: unknown) {
    const data = parseDomain(
      z.object({
        registrationId: z.string().uuid(),
        timeSlotId: z.string().uuid(),
      }),
      input,
    );
    return repository.transaction(async (tx) => {
      const registration = await repository.registration(
        tx,
        data.registrationId,
      );
      const slot = await repository.slot(tx, data.timeSlotId);
      if (!registration || !slot)
        throw new AppError('Registration or time slot not found', 404);
      if (registration.campaignId !== slot.campaignId)
        throw new AppError('Time slot belongs to another campaign', 400);
      if (
        registration.checkIn ||
        !(['PENDING', 'WAITLISTED', 'SCHEDULED'] as string[]).includes(
          registration.status,
        )
      ) {
        throw new AppError(
          'Registration cannot be scheduled in its current state',
          409,
        );
      }
      const now = new Date();
      if (
        slot.campaign.status !== 'OPEN' ||
        (slot.campaign.registrationOpensAt &&
          now < slot.campaign.registrationOpensAt) ||
        (slot.campaign.registrationClosesAt &&
          now >= slot.campaign.registrationClosesAt) ||
        now >= slot.startsAt
      ) {
        throw new AppError(
          'Campaign or time slot is not open for scheduling',
          409,
        );
      }
      validateTimeSlot(slot, slot.campaign);
      const occupied = await repository.occupied(tx, slot.id, registration.id);
      if (occupied >= slot.capacity)
        throw new AppError('Time slot is full', 409);
      return repository.schedule(tx, registration.id, slot.id);
    });
  },
};
