# auth

Phase 1 chốt chiến lược, Phase 2 triển khai endpoint.

- Access token: JWT ngắn hạn (mặc định 15 phút), gửi qua `Authorization: Bearer`.
- Refresh token: cookie HttpOnly + Secure + SameSite (`bd_refresh_token`, mặc định 30 ngày).
- `POST /auth/refresh` xoay phiên (rotation), `POST /auth/logout` thu hồi phiên — không xoá user.
- Chỉ lưu hash: `AuthSession.tokenHash`, `PasswordResetToken.tokenHash`; mật khẩu dùng scrypt (`common/security/password.ts`).
- `GET /auth/me` trả `CurrentUser = { id, email, fullName, roles, permissions }` cho protected route, sidebar/menu và action visibility.

Cấu hình ở `config/auth.config.ts`; bí mật đọc từ `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (bắt buộc set ở Phase 2, tối thiểu 32 ký tự).

## Trạng thái Phase 2

Đã triển khai: `login`, `refresh` (rotation + phát hiện replay qua `replacedById`),
`logout`, `GET/PATCH /auth/me`, `register`, `forgot-password`/`reset-password`.
`authenticate` (middleware toàn cục trong `app.ts`) verify access token và điền
`req.auth`; route bảo vệ vẫn cần `requireAuth`/`requirePermission` phía sau.

`register`, `forgot-password`, `reset-password` **chưa nằm trong
`docs/api/frontend-contract.md` đã duyệt** — implement theo checklist bàn giao
BE→FE nhưng cần PM xác nhận scope trước khi FE tích hợp (xem ghi chú trong
frontend-contract.md).

Chưa làm: gửi email thật cho forgot-password (đang log token ra console ngoài
production), rate limit cho login/register, đăng ký STAFF/ADMIN qua API (đợi
Phase 8).
Actor lấy từ `req.auth`, không bao giờ từ header do client gửi.
Ghi audit: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PASSWORD_CHANGED`, `USER_CREATED` (khi register).
