# blood-bags

Phase 1 đã có rule (chưa có HTTP CRUD).

`blood-bag.validation.ts`:

- `assertBloodBagTransition` — `BLOOD_BAG_TRANSITIONS`: `CREATED → COLLECTED → PENDING_TEST → TESTED → ACCEPTED | REJECTED`; `REJECTED → DISCARDED`; `ACCEPTED`/`DISCARDED` là trạng thái kết thúc.
- `assertBagVolumesReconcile(donationVolumeMl, bagVolumesMl)` — đối soát thể tích: tổng `volumeMl` của các túi phải bằng `Donation.volumeMl` (mọi thể tích tính bằng ml). Với thiết kế hiện tại 1 Donation → N BloodBag, trường hợp một túi tương đương "hai giá trị bằng nhau". Lỗi trả `DONATION_RECONCILIATION_FAILED` hoặc `DONATION_VOLUME_INVALID`.

Túi máu luôn gắn với một Donation; cấp chứng nhận thuộc Donation, không thuộc từng túi.

## Quyền sở hữu

`bloodbag.read`, `bloodbag.create`, `bloodbag.update_status` thuộc **chỉ DONATION_STAFF**. DONOR, COORDINATOR và SYSTEM_ADMIN không có quyền túi máu.
Phase 2 sẽ gọi `assertBagVolumesReconcile` trong transaction khi ghi nhận túi và ghi audit `BLOOD_BAG_CREATED` / `BLOOD_BAG_STATUS_CHANGED`.
