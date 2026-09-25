# roles

Phase 1 dùng mô hình 4 actor (nguồn duy nhất: `ROLE_CODES` / `ACTOR_CODES` trong `@blood/shared-types`):

| Code             | Tên                             |
| ---------------- | -------------------------------- |
| `DONOR`          | Người hiến máu                   |
| `DONATION_STAFF` | Nhân viên tiếp nhận / sàng lọc    |
| `COORDINATOR`    | Điều phối viên                   |
| `SYSTEM_ADMIN`   | Quản trị viên                    |

Không còn `RECEPTION_STAFF`, `MEDICAL_STAFF`, `BLOOD_COLLECTION_STAFF`, `ADMIN` (và các role cũ hơn
`SCREENING_STAFF`, `DOCTOR`) trong seed, guard hay test. Migration
`20260924000000_phase1_actor_role_model` gộp `RECEPTION_STAFF` + `MEDICAL_STAFF` +
`BLOOD_COLLECTION_STAFF` vào `DONATION_STAFF`, đổi tên `ADMIN` thành `SYSTEM_ADMIN`, và tạo mới
`COORDINATOR` — `COORDINATOR` là actor độc lập, **không gộp** vào `SYSTEM_ADMIN`.

`pnpm db:seed` upsert 4 role và đồng bộ `RolePermission` theo `ROLE_PERMISSIONS` (tạo thiếu, xoá thừa, chạy lặp an toàn). Chưa có endpoint CRUD role (Phase 2, permission `role.read` / `role.manage`).

## Trách nhiệm và số permission

| Role             | Trách nhiệm                                                                                                | Số permission |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| `DONOR`          | Đăng ký hiến máu, khai báo sức khỏe, xem lịch sử/chứng nhận của mình                                         | 15             |
| `DONATION_STAFF` | Check-in/tra cứu người hiến, sàng lọc/đánh giá, ghi nhận quá trình hiến, phản ứng sau hiến, cấp chứng nhận   | 25             |
| `COORDINATOR`    | Tạo/quản lý đợt hiến, thiết lập lịch & chỉ tiêu, phân công nhân sự, theo dõi tiến độ & báo cáo               | 19             |
| `SYSTEM_ADMIN`   | Quản lý tài khoản, role/permission, danh mục & cấu hình, audit log & báo cáo hệ thống                        | 16             |

Nguyên tắc: mỗi quyền nghiệp vụ (ghi) chỉ thuộc đúng **một** role; `campaign.*`/`timeslot.*`/`campaign_staff.*`
thuộc COORDINATOR; `screening.*`/`donation.*`/`bloodbag.*`/`reaction.*`/`certificate.issue` thuộc
DONATION_STAFF; `certificate.revoke` chỉ SYSTEM_ADMIN. `notification.read` là quyền dùng chung duy nhất của
cả 4 role.
