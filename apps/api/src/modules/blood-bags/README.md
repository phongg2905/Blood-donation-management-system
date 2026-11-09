# blood-bags

Quản lý túi máu thu nhận (`BloodBag`) gắn với lượt hiến máu (`Donation`).

## Quy chuẩn mã định danh đơn vị máu (Thông tư 26/2013/TT-BYT)

- Mỗi túi máu có một mã định danh đơn vị máu duy nhất (`code` unique) theo định dạng chuẩn:
  `\<Mã Đơn Vị\>-\<YYYY\>-WB-\<5 chữ số\>` (ví dụ: `NIHBT-2026-WB-00245`, `CR-2026-WB-00108`, `RC-2026-WB-00112`).
- Tiền tố `<Mã Đơn Vị>` được xác định theo cơ sở y tế / đơn vị tiếp nhận đợt hiến máu (`NIHBT`, `CR`, `BTH`, `BM`, `DNG`, `HUE`, `UMP`, `TN`, `QY175`, `RC`), `WB` biểu thị máu toàn phần (*Whole Blood*).
- Trên giao diện thu nhận (`QuickCollectModal` và `NewBloodBagPage`), hệ thống tự động sinh sẵn mã chuẩn theo đợt hiến máu và cho phép nhân viên bấm **"Cấp mã mới"** hoặc dùng máy quét barcode quét đè nhãn túi thực tế.

## Quy tắc nghiệp vụ (`blood-bag.validation.ts`)

- `assertBloodBagTransition` — `BLOOD_BAG_TRANSITIONS`: `CREATED → COLLECTED → PENDING_TEST → TESTED → ACCEPTED | REJECTED`; `REJECTED → DISCARDED`; `ACCEPTED`/`DISCARDED` là trạng thái kết thúc.
- `assertBagVolumesReconcile(donationVolumeMl, bagVolumesMl)` — đối soát thể tích: tổng `volumeMl` của các túi phải bằng `Donation.volumeMl` (mọi thể tích tính bằng ml). Với thiết kế hiện tại 1 Donation → N BloodBag, trường hợp một túi tương đương "hai giá trị bằng nhau". Lỗi trả `DONATION_RECONCILIATION_FAILED` hoặc `DONATION_VOLUME_INVALID`.

Túi máu luôn gắn với một `Donation`; việc ghi nhận túi máu thực hiện trong transaction kèm đối soát thể tích và ghi nhận `AuditLog`.

## Quyền sở hữu

`bloodbag.read`, `bloodbag.create`, `bloodbag.update_status` thuộc **chỉ DONATION_STAFF**. DONOR, COORDINATOR và SYSTEM_ADMIN không có quyền thao tác túi máu.
