# roles

Phase 1 đã cố định mô hình 5 role (nguồn duy nhất: `ROLE_CODES` trong `@blood/shared-types`):

| Code                     | Tên                 |
| ------------------------ | ------------------- |
| `DONOR`                  | Người hiến máu      |
| `RECEPTION_STAFF`        | Nhân viên tiếp nhận |
| `MEDICAL_STAFF`          | Nhân viên y tế      |
| `BLOOD_COLLECTION_STAFF` | Nhân viên lấy máu   |
| `ADMIN`                  | Quản trị viên       |

Không còn `SCREENING_STAFF`, `DOCTOR`, `COORDINATOR` trong source, seed, guard hay test.
Migration `20260919000000_phase1_rbac_and_auth_sessions` đã gộp dữ liệu role cũ trong DB.

`pnpm db:seed` upsert 5 role và đồng bộ `RolePermission` theo `ROLE_PERMISSIONS` (tạo thiếu, xoá thừa, chạy lặp an toàn). Chưa có endpoint CRUD role (Phase 2, permission `role.read` / `role.manage`).

## Trách nhiệm và số permission

| Role                     | Trách nhiệm                                                          | Số permission |
| ------------------------ | -------------------------------------------------------------------- | ------------- |
| `DONOR`                  | Đăng ký hiến máu, khai báo sức khỏe, xem lịch sử/chứng nhận của mình | 15            |
| `RECEPTION_STAFF`        | Tra cứu người hiến, check-in, ghi nhận no-show                       | 10            |
| `MEDICAL_STAFF`          | Nhập chỉ số/xét nghiệm, kết luận sàng lọc trước hiến                 | 14            |
| `BLOOD_COLLECTION_STAFF` | Lấy máu, quản lý túi máu, ghi nhận phản ứng sau hiến, cấp chứng nhận | 18            |
| `ADMIN`                  | Toàn quyền hệ thống (superset)                                       | 53            |

Nguyên tắc: mỗi quyền nghiệp vụ (ghi) chỉ thuộc tối đa **một** role ngoài ADMIN; MEDICAL_STAFF không thực hiện lấy máu; `certificate.revoke` chỉ ADMIN. `notification.read` là quyền dùng chung duy nhất của cả 5 role.
