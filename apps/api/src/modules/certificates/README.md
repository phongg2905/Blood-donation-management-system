# certificates

Phase 1 đã có rule (chưa có HTTP CRUD).

`certificate.validation.ts`:

- `assertCanIssueCertificate(status)` — chỉ `Donation.status = COMPLETED`; `PENDING`, `IN_PROGRESS`, `STOPPED` đều bị chặn (`DONATION_NOT_COMPLETED`). Lượt hiến bị dừng không bao giờ được cấp chứng nhận.
- `assertCertificateIssuable(status, existing)` — thêm: một Donation chỉ có một Certificate (`CERTIFICATE_NOT_ALLOWED` nếu đã tồn tại).
- `assertCanRevokeCertificate(status)` — chỉ thu hồi được khi đang `ACTIVE` (`CERTIFICATE_ALREADY_REVOKED` ngược lại).

Thu hồi ghi `status = REVOKED`, `revokedAt`, `revokeReason` trong cùng transaction và ghi audit `CERTIFICATE_REVOKED`; không hard-delete.

## Quyền sở hữu

- `certificate.read`: DONOR, DONATION_STAFF.
- `certificate.issue`: **chỉ DONATION_STAFF** — role hoàn tất nghiệp vụ donation nên cấp chứng nhận.
- `certificate.revoke`: **chỉ SYSTEM_ADMIN** vì đây là hành động quản trị nhạy cảm, tách khỏi nghiệp vụ hiến máu.

COORDINATOR không có quyền chứng nhận nào (không quản lý nghiệp vụ hiến máu trực tiếp).
