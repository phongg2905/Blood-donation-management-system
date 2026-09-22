# auth

Phase 1 chốt chiến lược, Phase 2 triển khai endpoint.

- Access token: JWT ngắn hạn (mặc định 15 phút), gửi qua `Authorization: Bearer`.
- Refresh token: cookie HttpOnly + Secure + SameSite (`bd_refresh_token`, mặc định 30 ngày).
- `POST /auth/refresh` xoay phiên (rotation), `POST /auth/logout` thu hồi phiên — không xoá user.
- Chỉ lưu hash: `AuthSession.tokenHash`, `PasswordResetToken.tokenHash`; mật khẩu dùng scrypt (`common/security/password.ts`).
- `GET /auth/me` trả `CurrentUser = { id, email, fullName, roles, permissions }` cho protected route, sidebar/menu và action visibility.

Cấu hình ở `config/auth.config.ts`; bí mật đọc từ `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (bắt buộc set ở Phase 2, tối thiểu 32 ký tự).

Rate limit theo IP cho `login`/`register` và `forgot-password`/`reset-password` ở `middlewares/rate-limit.middleware.ts` (mặc định 10 và 5 request/15 phút, chỉnh qua `RATE_LIMIT_LOGIN_MAX`/`RATE_LIMIT_RESET_MAX`; trả HTTP 429 với envelope chuẩn, tắt khi `NODE_ENV=test`).

`forgot-password` gửi email qua SMTP (`password-reset.mailer.ts`, cấu hình `SMTP_*` + `RESET_PASSWORD_URL`); nếu chưa cấu hình SMTP ngoài production thì trả `devResetToken` như trước. Khi gửi lỗi, token bị vô hiệu và response vẫn giữ dạng chung để tránh lộ thông tin tài khoản.

Đồng thời/concurrency: mọi mutation bảo mật của một user (đổi mật khẩu, reset, xoay phiên refresh) khoá dòng `User` (`SELECT ... FOR UPDATE`) trong một transaction và tiêu thụ token bằng `updateMany` có điều kiện — một reset token hoặc refresh token chỉ được dùng đúng một lần kể cả khi gọi đồng thời (test hồi quy trong `auth.test.ts`).

## Trạng thái Phase 2

Đã triển khai: `login`, `refresh` (rotation + phát hiện replay qua `replacedById`),
`logout`, `GET/PATCH /auth/me`, `register`, `forgot-password`/`reset-password`.
`authenticate` (middleware toàn cục trong `app.ts`) verify access token và điền
`req.auth`; route bảo vệ vẫn cần `requireAuth`/`requirePermission` phía sau.

`register`, `forgot-password`, `reset-password` **chưa nằm trong
`docs/api/frontend-contract.md` đã duyệt** — implement theo checklist bàn giao
BE→FE nhưng cần PM xác nhận scope trước khi FE tích hợp (xem ghi chú trong
frontend-contract.md).

`CurrentUser` hiện trả thêm `phone`/`address` (nullable, từ `DonorProfile`,
chỉ DONOR có profile) để FE hiển thị và cho sửa thông tin liên hệ trên trang
hồ sơ. Contract cần được PM duyệt bổ sung trước khi coi là chốt.

Chưa làm: đăng ký STAFF/ADMIN qua API (đợi Phase 8).
Actor lấy từ `req.auth`, không bao giờ từ header do client gửi.
Ghi audit: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PASSWORD_CHANGED`, `USER_CREATED` (khi register).
