# screenings

Phase 1 đã có rule + schema (chưa có HTTP CRUD).

`screening.validation.ts`:

- `assertCanScreen(checkInId)` — sàng lọc chỉ sau check-in hợp lệ.
- `assertScreeningTransition` — `SCREENING_TRANSITIONS`: `PENDING → WAITING_REVIEW`; `WAITING_REVIEW → ELIGIBLE | INELIGIBLE | DEFERRED`.
- `validateScreeningReview` — `DEFERRED` bắt buộc `decisionReason` (có thể kèm `deferredUntil` dạng ngày).
- `assertScreeningEligibleForDonation(status)` — chỉ `ELIGIBLE` mới sang donation.
- `validateScreeningTests` — `code` phải thuộc `SCREENING_TEST_CATALOG` (`SCREENING_TEST_CODE_INVALID` nếu không), không cho mã trùng trong cùng phiếu.
- `validateScreeningMeasurements` — Zod + giới hạn cấu trúc; ngưỡng y tế vẫn thuộc policy/`SystemSetting`, không hard-code.

Đơn vị chuẩn: `weightKg` (kg), `temperatureC` (°C), `systolicBp`/`diastolicBp` (mmHg), `pulse` (bpm), `hemoglobin` (g/dL) — lấy từ `MEASUREMENT_UNITS`.

Unique `(screeningId, code)` giữ một kết quả hiện hành cho mỗi mã.

## Quyền sở hữu

`screening.read`, `screening.create`, `screening.update`, `screening.review` thuộc **chỉ DONATION_STAFF**. DONOR không có quyền sàng lọc; COORDINATOR và SYSTEM_ADMIN cũng không. DONATION_STAFF kết luận ELIGIBLE/INELIGIBLE/DEFERRED và thực hiện lấy máu — hai bước này gộp vào cùng một role kể từ mô hình 4-actor.
