# registrations

Phase 1 đã có rule + schema (chưa có HTTP CRUD).

`registration.validation.ts`:

- `validateCreateRegistration` / `validateScheduleRegistration` (Zod).
- `assertRegistrationTransition` — dùng `REGISTRATION_TRANSITIONS` (centralized).
- `resolveScheduleOutcome` — `PENDING`/`WAITLISTED` → `SCHEDULED`; `SCHEDULED`/`CONFIRMED` → reschedule giữ nguyên trạng thái; còn lại bị chặn.
- `assertCanCheckIn` — chỉ `SCHEDULED`/`CONFIRMED`, và chỉ một lần.
- `assertCanMarkNoShow` — chỉ từ `SCHEDULED`/`CONFIRMED`.
- `assertSingleRegistrationPerCampaign` — unique `(donorId, campaignId)`; bản ghi `CANCELLED` được tái sử dụng (update) thay vì tạo mới.
- `assertNoScheduleOverlap` — chặn lịch trùng của cùng donor (khoảng nửa mở).

Rule ở tầng campaign (`campaign.validation.ts`): chỉ `OPEN` nhận đăng ký, phải nằm trong cửa sổ đăng ký.
Rule khung giờ (`time-slot.validation.ts`): slot phải active, còn chỗ; `CANCELLED`/`WAITLISTED` không chiếm chỗ.

Các rule này đã được enforce trong `timeSlotService.schedule` và sẽ được dùng lại cho endpoint Phase 2 (`registration.read/create/reschedule/cancel/checkin/mark_no_show`).

## Quyền sở hữu

- `registration.create`, `registration.reschedule`, `registration.cancel`: **DONOR** (tự phục vụ).
- `registration.read`: DONOR, RECEPTION_STAFF, MEDICAL_STAFF, BLOOD_COLLECTION_STAFF, ADMIN.
- `registration.checkin`, `registration.mark_no_show`: **RECEPTION_STAFF** (nghiệp vụ tiếp nhận).

MEDICAL_STAFF, BLOOD_COLLECTION_STAFF và RECEPTION_STAFF đều không có quyền tạo/huỷ đăng ký của donor.
