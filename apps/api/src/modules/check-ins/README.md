# check-ins

Phase 1 đã có rule (chưa có HTTP CRUD).

- Chỉ check-in khi registration ở `SCHEDULED` hoặc `CONFIRMED` — `assertCanCheckIn` trong `modules/registrations/registration.validation.ts` trả `CHECK_IN_NOT_ALLOWED` cho `PENDING`, `WAITLISTED`, `CANCELLED`, `NO_SHOW`, `COMPLETED`.
- Mỗi registration chỉ có một check-in hợp lệ (`CheckIn.registrationId` unique); check-in lần hai trả `REGISTRATION_ALREADY_CHECKED_IN`.
- `checkedInById` lấy từ actor đã xác thực; check-in là điều kiện bắt buộc trước Screening (`CHECK_IN_REQUIRED`) và Donation.
- Sau check-in, registration không thể reschedule (`resolveScheduleOutcome` chặn).

Phase 2 ghi audit `REGISTRATION_CHECKED_IN`.

`registration.checkin` và `registration.mark_no_show` chỉ thuộc **RECEPTION_STAFF** (và ADMIN). MEDICAL_STAFF và BLOOD_COLLECTION_STAFF không check-in.
