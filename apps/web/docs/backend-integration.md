# Tích hợp auth theo API BE bàn giao

## Phạm vi và nguyên tắc

Frontend thích ứng với API gốc của BE. Các thay đổi tự thêm ở `apps/api`,
`packages/shared-types` và `docs/api` đã được hoàn lại theo bản local
`c2dd658` (commit này không thay đổi backend).

Quy tắc phối hợp được lưu trong [AGENTS.md](../../../AGENTS.md).
Tài liệu này ghi nhận phía FE; không thay thế hợp đồng API hoặc xác nhận
hoàn thành phase của đội BE.

## Hành vi frontend

- Mặc định dùng API thật; mock chỉ bật khi `VITE_USE_MOCK_API=true`.
- Đăng ký nhận access token và user từ API để tạo phiên đăng nhập.
- Đặt lại mật khẩu gửi `{ token, newPassword }`. Lỗi ở trường
  `newPassword` được hiển thị tại ô mật khẩu mới trên form.
- Hồ sơ: `CurrentUser` trả thêm `phone`/`address` (nullable, chỉ DONOR có).
  Trang hồ sơ cho DONOR xem và sửa cả ba trường `fullName`, `phone`,
  `address`; STAFF/ADMIN chỉ sửa `fullName` (gửi phone/address cho tài khoản
  không phải DONOR bị BE từ chối `VALIDATION_ERROR`). FE đối chiếu luật
  8–20 ký tự cho phone và 1–500 ký tự cho address theo validator BE.
- Quên mật khẩu sử dụng `devResetToken` khi BE trả về ở môi trường phát triển
  (khi đã cấu hình SMTP, BE gửi email và không trả token).
- Login/register và forgot/reset-password bị BE giới hạn theo IP
  (mặc định 10 và 5 request/15 phút). Vượt hạn trả HTTP 429 với
  `error.code = "FORBIDDEN"`; FE hiện `error.message` như lỗi thường.
- Giới hạn tên 1–200 ký tự sau trim và mật khẩu mới 8–128 ký tự,
  có chữ thường, chữ hoa và chữ số, theo validator hiện có của BE.

## Kiểm chứng

- Test adapter FE đối chiếu request đăng ký, đặt lại mật khẩu và cập nhật
  hồ sơ với validator BE hiện có, chỉ đọc source BE.
- Test giao diện kiểm tra thông báo lỗi mật khẩu và hồ sơ với
  `CurrentUser` không chứa thông tin liên hệ.
- Test mock/contract không thay thế kiểm thử HTTP thật, cookie trên trình duyệt
  và PostgreSQL. Kết quả kiểm tra local với PostgreSQL được ghi bên dưới.
- Các hạng mục thiếu như email thật và API đọc thông tin liên hệ cần được
  đội phụ trách thống nhất; FE không tự quyết định chuyển sang phase khác.

Chạy từ root project:

```powershell
pnpm.cmd build:shared
pnpm.cmd --filter @blood/web test
pnpm.cmd --filter @blood/web typecheck
pnpm.cmd --filter @blood/web build
```

## Kết quả kiểm tra khi Docker đã chạy

- PostgreSQL 16 ở trạng thái healthy, cổng local 5434.
- Bộ test BE gốc: 51/51 đạt qua `pnpm.cmd --filter @blood/api test`.
- Adapter `ApiAuthService` hiện có của FE gọi HTTP tới app Express gốc trên
  cổng local tạm, dùng PostgreSQL thật: đăng ký, đọc/sửa họ tên, refresh sau
  khi xóa access token trong bộ nhớ, logout, quên/đặt lại mật khẩu đều đạt.
- Sau reset: refresh token cũ bị từ chối, mật khẩu cũ không đăng nhập được,
  mật khẩu mới đăng nhập được, dùng lại reset token theo thứ tự bị từ chối.
- Response `CurrentUser` thực tế có `id, email, fullName, phone, address,
  roles, permissions` (phone/address nullable, chỉ DONOR có giá trị).
- Đây là kiểm tra adapter FE qua Node với cookie được chuyển tiếp trong script;
  chưa phải kiểm thử trình duyệt đối với SameSite/Secure/CORS hoặc gửi email thật.

### Hai lỗi đồng thời đã báo trước đây — BE đã xử lý trong bản local

1. **Một reset token bị chấp nhận hai lần khi request đồng thời** — đã fixed:
   BE tiêu thụ token bằng `updateMany` có điều kiện trong một transaction
   khoá dòng `User` (`SELECT ... FOR UPDATE`), đồng thời đổi mật khẩu và thu
   hồi mọi phiên trong cùng transaction. Test hồi quy
   `concurrent reset-password calls with one token succeed at most once`
   thuộc bộ test BE đạt (kỳ vọng `200 + 400`, chỉ một trong hai mật khẩu mới
   đăng nhập được).

2. **Một refresh token bị xoay hai lần khi request đồng thời** — đã fixed:
   rotation dùng `updateMany` có điều kiện (`revokedAt IS NULL` và chưa hết
   hạn) trong transaction khoá dòng `User`; request thua cuộc nhận 401 và
   **không** thu hồi phiên của request thắng cuộc (double-tab/double-submit
   không còn làm đăng xuất người dùng). Test hồi quy
   `concurrent refresh calls with one cookie issue one session at most`
   thuộc bộ test BE đạt (kỳ vọng `200 + 401`, cookie mới của request thắng
   cuộc vẫn dùng tiếp được).

Cả hai test hồi quy đã được BE thêm vào `auth.test.ts` và chạy trên
PostgreSQL thật. Đây là phần BE xác nhận qua test, không phải FE xác nhận
hộ; khi hợp nhất code chính thức, đội BE cần review và sign-off.

Tài khoản, hồ sơ và audit record do script kiểm tra bổ sung tạo đã được dọn
theo đúng ID fixture; script tạm và server tạm đã được dọn sau kiểm tra.
Source BE, shared contract và tài liệu API không bị thay đổi.
