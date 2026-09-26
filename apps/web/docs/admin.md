# Khu quản trị (FE, mock)

Khu dành cho **SYSTEM_ADMIN**: tài khoản, vai trò & quyền, nhật ký hoạt động,
cấu hình hệ thống và báo cáo.

Phần này **chỉ FE**. Backend chưa có route nào cho các endpoint dưới đây (hiện BE
chỉ có `/auth/*` và `/health`), nên toàn bộ dữ liệu chạy qua mock trong
`src/features/admin/`. Không sửa `apps/api/**`, Prisma, seed, `packages/shared-*`
hay `docs/api/**`.

## Route và quyền

| Route               | Màn hình          | Permission                                           | Endpoint trong hợp đồng          |
| ------------------- | ----------------- | ---------------------------------------------------- | -------------------------------- |
| `/admin/users`      | Người dùng        | `user.read`                                          | `GET /users`                     |
| `/admin/roles`      | Vai trò & quyền   | `role.read` (+ `permission.read` cho danh mục quyền) | `GET /roles`, `GET /permissions` |
| `/admin/audit-logs` | Nhật ký hoạt động | `audit.read`                                         | `GET /audit-logs`                |
| `/admin/settings`   | Cấu hình hệ thống | `setting.read`                                       | `GET /settings`                  |
| `/admin/reports`    | Báo cáo hiến máu  | `report.read`                                        | `GET /reports/donations`         |

Nguồn: mục **Administration** trong `docs/api/frontend-contract.md`. Năm quyền
trên chỉ SYSTEM_ADMIN có, nên kiểm tra permission đã là ranh giới phân quyền.

Thao tác ghi chỉ hiện khi có quyền, và **chỉ trong mock mới chạy được**:

| Thao tác                          | Permission       | Endpoint                        |
| --------------------------------- | ---------------- | ------------------------------- |
| Sửa họ tên / trạng thái tài khoản | `user.manage`    | `PATCH /users/:id`              |
| Gán vai trò cho tài khoản         | `role.manage`    | `POST /users/:id/roles`         |
| Sửa giá trị cấu hình              | `setting.manage` | `PUT /settings/:key`            |
| Xuất CSV báo cáo                  | `report.export`  | `GET /reports/donations/export` |

Menu quản trị nằm trong `features/auth/navigation.ts`, lọc theo đúng các quyền
trên. Nav vì vậy chỉ hiện với SYSTEM_ADMIN và không cần thêm trường `roles`.

## Mock

- Bật mặc định trong development: `import.meta.env.DEV && VITE_USE_MOCK_ADMIN !== 'false'`.
  Đặt `VITE_USE_MOCK_ADMIN=false` để tắt. `VITE_ADMIN_MOCK_LATENCY` chỉnh độ trễ.
- Ngoài dev (hoặc khi tắt mock), `ApiAdminRepository` gọi đúng các path ở bảng
  trên; UI hiện trạng thái "chưa hỗ trợ" (503) thay vì dữ liệu giả.
- `mock-repository.ts` là store in-memory, reset khi tải lại trang. Vai trò,
  quyền và ma trận quyền đọc thẳng từ `@blood/shared-types`
  (`ACTOR_CODES`, `ROLE_PERMISSIONS`, `PERMISSION_CODES`) nên mock không thể
  lệch khỏi mô hình 4 actor thật.
- Nhật ký, cấu hình và số liệu báo cáo là dữ liệu minh họa; action/entity dùng
  đúng `AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES` của shared-types.

## Quy tắc đã tuân thủ

- Không thêm quyền, mã lỗi, endpoint hay quy tắc nghiệp vụ mới. Không dùng mock
  để coi như BE đã hỗ trợ.
- Trạng thái/vai trò dùng đúng mã của shared-types; không hard-code mã legacy.
- Báo cáo không phụ thuộc feature campaign: SYSTEM_ADMIN **không** có
  `campaign.read`, nên bộ lọc "Đợt hiến" được dựng từ chính dữ liệu báo cáo.
- Người dùng bị khoá vẫn giữ dữ liệu; chỉ không đăng nhập được.

## Chức năng đang chờ BE

Khi BE bàn giao, chỉ thay `ApiAdminRepository` trong `repository.ts`; UI/component
không đổi. Cần:

1. `GET /users`, `PATCH /users/:id`, `POST /users/:id/roles` — kèm envelope phân
   trang và projection user (email, fullName, isActive, roles, lastLoginAt).
2. `GET /roles`, `GET /permissions` — ma trận quyền và danh mục quyền.
3. `GET /audit-logs` — bộ lọc `actorId`, `action`, `entityType`, `entityId`,
   `from`, `to`, phân trang.
4. `GET /settings`, `PUT /settings/:key` — danh sách và cập nhật giá trị.
5. `GET /reports/donations` — số liệu theo `campaignId`, `from`, `to`.

### Ghi nhận cần BE xác nhận

- **Cơ chế tải tệp xuất báo cáo**: hợp đồng ghi `GET /reports/donations/export`
  trả CSV/Excel, không nằm trong envelope JSON mà transport dùng. Cần thống nhất
  cách tải (fetch thô, signed URL, hay base64 trong envelope) trước khi nối.
  Hiện `ApiAdminRepository.exportDonationReport` cố ý trả 503, không tự bịa tệp.
- **Sửa vai trò/quyền**: hợp đồng mới có gán vai trò cho _tài khoản_
  (`POST /users/:id/roles`), **chưa** có endpoint sửa ma trận quyền của vai trò.
  Màn "Vai trò & quyền" vì vậy chỉ đọc.
- **Quản lý thông báo** (`notification.manage`) thuộc SYSTEM_ADMIN nhưng chưa có
  endpoint riêng trong mục Administration nên chưa dựng màn.
