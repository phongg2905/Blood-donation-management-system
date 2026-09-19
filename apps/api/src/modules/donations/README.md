# donations

Phase 1 đã có rule + validation (chưa có HTTP CRUD).

`donation.validation.ts`:

- `assertCanStartDonation({ checkInId, screeningStatus })` — chuỗi bắt buộc: registration hợp lệ → đã check-in → `Screening.status = ELIGIBLE`. Thiếu check-in trả `CHECK_IN_REQUIRED`, sàng lọc chưa đủ điều kiện trả `SCREENING_NOT_ELIGIBLE`.
- `assertDonationTransition` — `DONATION_TRANSITIONS`: `PENDING → IN_PROGRESS → COMPLETED | STOPPED`; `COMPLETED`/`STOPPED` là trạng thái kết thúc.
- `validateDonation` — thứ tự thời gian `startedAt <= completedAt <= donatedAt` (`DONATION_TIME_INVALID`).
- `validateDonationCompletion` — khi `COMPLETED` phải có `startedAt`, `completedAt`, `volumeMl > 0`; `performedById` lấy từ actor đã xác thực (`assertDonationPerformer`), không từ body.
- `STOPPED` không được cấp Certificate (xem `modules/certificates`).

Thể tích dùng ml và phải đối soát với tổng thể tích các túi máu (`modules/blood-bags`).
Phase 2 ghi audit `DONATION_STARTED`, `DONATION_COMPLETED`, `DONATION_STOPPED`.

## Quyền sở hữu

`donation.start`, `donation.complete`, `donation.stop` thuộc **BLOOD_COLLECTION_STAFF** (và ADMIN). MEDICAL_STAFF chỉ có `donation.read` để theo dõi; RECEPTION_STAFF chỉ có `registration.read` và không thao tác donation.
BLOOD_COLLECTION_STAFF chỉ bắt đầu được khi `Screening.status = ELIGIBLE` (`assertCanStartDonation`) và không có `screening.review`.
