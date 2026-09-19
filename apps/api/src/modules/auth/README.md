# auth

Phase 1 chốt chiến lược, Phase 2 triển khai endpoint.

- Access token: JWT ngắn hạn (mặc định 15 phút), gửi qua `Authorization: Bearer`.
- Refresh token: cookie HttpOnly + Secure + SameSite (`bd_refresh_token`, mặc định 30 ngày).
- `POST /auth/refresh` xoay phiên (rotation), `POST /auth/logout` thu hồi phiên — không xoá user.
- Chỉ lưu hash: `AuthSession.tokenHash`, `PasswordResetToken.tokenHash`; mật khẩu dùng scrypt (`common/security/password.ts`).
- `GET /auth/me` trả `CurrentUser = { id, email, fullName, roles, permissions }` cho protected route, sidebar/menu và action visibility.

Cấu hình ở `config/auth.config.ts`; bí mật đọc từ `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (tùy chọn ở Phase 1).

Chưa làm: đăng nhập, refresh/logout, đổi mật khẩu, quên mật khẩu, gửi email, rate limit.
Khi triển khai: routes → controller → service → repository → Prisma. Actor lấy từ `req.auth`, không bao giờ từ header do client gửi.
Ghi audit: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `PASSWORD_CHANGED`.
