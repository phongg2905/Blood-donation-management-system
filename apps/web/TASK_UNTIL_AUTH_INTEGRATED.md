# Phase 2 Auth Integration Pending

Current state:

- Auth UI hoàn chỉnh.
- Frontend đang dùng mock adapter.
- Chờ Backend Auth API thật.

Khi Backend Phase 2 hoàn thành:

1. Đọc `docs/api/frontend-contract.md`
2. Implement/hoàn thiện ApiAuthService
3. Map request/response thật
4. Cấu hình credentials/cookie/token
5. Chuyển mock → real
6. Test toàn bộ auth flow
7. Verify role/permission

Completion conditions:

- Login API thật hoạt động
- Register thật hoạt động
- Refresh thật hoạt động nếu contract có
- Logout thật hoạt động
- Forgot/reset thật hoạt động
- `/auth/me` thật hoạt động
- CurrentUser thật có roles + permissions
- ProtectedRoute hoạt động
- PermissionGuard hoạt động
- Không còn mock trong production path
- typecheck/lint/test/build pass

Cleanup rule:

CHỈ KHI tất cả điều kiện trên đã verify trong cùng task:

- xóa `TASK_UNTIL_AUTH_INTEGRATED.md`
- xóa mock Auth files nếu không còn cần
- xóa config chỉ phục vụ mock nếu không còn cần
- không xóa trước khi integration thật hoàn tất

---

## Open items (không có trong contract hiện tại)

Các mục dưới đây là điểm chưa xác nhận, phải kiểm tra lại khi nối API thật.
Sau khi xử lý xong thì xóa cả mục này.

### 1. Endpoint chưa được định nghĩa trong `docs/api/frontend-contract.md`

`ApiAuthService` (`src/features/auth/services/api-auth.service.ts`) đã map sẵn,
đường dẫn theo quy ước, đánh dấu `[unconfirmed]` trong code:

| Operation         | Path đang dùng               | Cần xác nhận                      |
| ----------------- | ---------------------------- | --------------------------------- |
| Đăng ký công khai | `POST /auth/register`        | path, body, response, status code |
| Quên mật khẩu     | `POST /auth/forgot-password` | path, body, response              |
| Đặt lại mật khẩu  | `POST /auth/reset-password`  | path, body, response              |

Các endpoint `[confirmed]` (có trong contract): `POST /auth/login`,
`POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me`.

### 2. Error code chưa có trong `@blood/shared-types`

`ERROR_CODES` của Phase 1 chỉ có `UNAUTHENTICATED` và `FORBIDDEN` cho nhóm auth.
Các code sau là **quy ước phía FE**, mock adapter phát ra và UI đã map sẵn
(`src/features/auth/auth-errors.ts`):

- `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `EMAIL_ALREADY_EXISTS`
- `RESET_TOKEN_INVALID`, `RESET_TOKEN_EXPIRED`

UI map **cả hai cách viết**, nên nếu backend trả `UNAUTHENTICATED` cho login sai
thì không cần sửa gì. Nếu backend dùng code khác, cập nhật bảng `MESSAGES` trong
`auth-errors.ts` (một chỗ duy nhất).

### 3. Token reset mật khẩu

Hiện đọc từ query string `?token=` (`ResetPasswordPage`). Cần chốt lại transport
thật (query, path param, hay POST body). Chỉ sửa 1 chỗ trong page.

### 4. `CurrentUser` chưa trả `phone` / `address`

`PATCH /auth/me` nhận `{ fullName?, phone?, address? }` nhưng `CurrentUser` không
trả `phone`/`address`, nên form Profile hiện chỉ sửa `fullName`. Khi API trả thêm
2 field này thì bật input tương ứng trong `features/profile/pages/ProfilePage.tsx`.

### 5. Chưa có password policy phía server

Phase 1 chưa có auth endpoint nên chưa có policy server-side. FE đang áp dụng:
tối thiểu 8 ký tự, có ít nhất 1 chữ cái và 1 chữ số
(`src/features/auth/validation.ts` → `PASSWORD_REQUIREMENTS`). Phải khớp với
policy thật của backend.

### 6. Dọn mock

- `src/features/auth/services/mock-auth.service.ts` (MockAuthService, DEMO_ACCOUNTS, DEMO_PASSWORD, MOCK_RESET_TOKENS)
- `src/features/auth/services/auth-service.resolver.ts` (chỉ giữ `ApiAuthService`)
- `src/features/auth/components/MockAccountsPanel.tsx`
- `VITE_USE_MOCK_API` trong `.env.example`
- Dev/test tiện dụng trong `src/test/render.tsx` (`signInAs`)
