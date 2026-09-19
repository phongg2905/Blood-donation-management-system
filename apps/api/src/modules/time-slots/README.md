# time-slots

Phase 1: `timeSlotService` (service nội bộ) đã enforce đầy đủ rule; chưa có HTTP CRUD.

`time-slot.validation.ts`: `timeSlotSchema` (campaignId, startsAt, endsAt, capacity > 0),
`validateTimeSlot` (startsAt < endsAt, slot nằm trong thời gian campaign),
`assertTimeSlotActive`, `assertTimeSlotHasCapacity`.

`timeSlotService.schedule` (transaction Serializable + retry P2034) kiểm tra theo thứ tự:

1. registration và slot tồn tại; slot thuộc đúng campaign.
2. registration chưa check-in và ở trạng thái cho phép xếp lịch (`resolveScheduleOutcome`).
3. **`slot.isActive === true`** — bắt buộc khi schedule/reschedule.
4. campaign đang `OPEN` và trong cửa sổ đăng ký; slot chưa bắt đầu.
5. slot vẫn nằm trong thời gian campaign (phòng trường hợp campaign bị sửa sau đó).
6. còn chỗ: `occupied < capacity`; `CANCELLED` và `WAITLISTED` không chiếm chỗ.
7. không trùng lịch với registration khác của cùng donor.
8. ghi audit `REGISTRATION_RESCHEDULED` / `REGISTRATION_CREATED` trong cùng transaction.

Capacity và trạng thái slot chỉ được đổi qua service để không bỏ qua các rule này; ghi thẳng Prisma/SQL sẽ bypass.
