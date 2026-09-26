# Tài khoản demo local

Bộ chọn tài khoản demo dùng mô hình 4-actor (`DONOR`, `DONATION_STAFF`, `COORDINATOR`, `SYSTEM_ADMIN`). Đăng nhập qua API auth hiện có, không bypass RBAC. Không sửa schema, seed hay ma trận quyền.

| Vai trò | Email |
| --- | --- |
| Người hiến máu | `donor.demo@example.local` |
| Nhân viên tiếp nhận / sàng lọc | `donation-staff.demo@example.local` |
| Điều phối viên | `coordinator.demo@example.local` |
| Quản trị hệ thống | `admin@example.local` |

Mật khẩu demo chung: `Demo@Password1`. Đây là tài khoản thử nghiệm local với credential công khai, không dùng cho dữ liệu production. `SYSTEM_ADMIN` không có email cố định trong seed BE: tài khoản `admin@example.local` ở trên chỉ được tạo khi chạy script cấp tài khoản demo bên dưới.

## Chọn trên login

Mở **Tài khoản demo**, chọn vai trò, rồi nhấn **Đăng nhập**. Mục phụ trợ chỉ điền form, không tự đăng nhập, không đổi auth adapter và không sửa quyền. Các nút bị khóa trong lúc đang đăng nhập.

Chỉ hiển thị trong Vite development, mặc định bật. Đặt `VITE_SHOW_DEMO_LOGIN=false` trong `.env`, khởi động lại Vite để ẩn. Production không import component/credential demo này. Nếu chủ động bật mock auth (`VITE_USE_MOCK_API=true`), picker dùng `mockEmail`/mật khẩu mock trong `mock-auth.service.ts` (`donor@/donation-staff@/coordinator@/admin@example.local`, mật khẩu `Blood@123`); tài khoản API thật không bị đổi.

## Gỡ phần phụ trợ

1. Trong `src/features/auth/pages/LoginPage.tsx`, bỏ khai báo lazy `DemoAccountPicker` và khối `<Suspense>` chứa picker; bỏ `lazy`, `Suspense` khỏi import React.
2. Xóa thư mục `src/features/auth/demo/` và script `scripts/provision-demo-accounts.ts` ở root project nếu không cần tạo lại tài khoản trên máy khác. Script import catalogue trong thư mục demo nên cần gỡ cùng nhau.
3. Bỏ dòng `VITE_SHOW_DEMO_LOGIN` khỏi cấu hình nếu muốn. Không phải sửa form, auth service, route hoặc CSS login hiện có.

Gỡ UI/script không tự xóa tài khoản trong database; dữ liệu vẫn tồn tại để đăng nhập thủ công. Không tự động xóa user có thể đã liên quan đến nghiệp vụ.

## Tạo trên máy khác / kiểm chứng

Từ root project:

```sh
pnpm --filter @blood/api exec tsx ../../scripts/provision-demo-accounts.ts
pnpm --filter @blood/api exec tsx ../../scripts/provision-demo-accounts.ts --verify
```

Lệnh đầu chỉ tạo tài khoản còn thiếu và gán role có sẵn trong một transaction. Nếu email đã tồn tại nhưng credential/role khác, script dừng, không ghi đè. Không chạy lại seed toàn bộ, không sửa quyền hoặc donor. Chỉ cho chạy với database localhost và môi trường không phải production.

Muốn xóa hẳn 4 tài khoản demo rồi tạo lại theo catalogue hiện tại (ví dụ sau khi đổi mô hình 4 actor), thêm cờ `--reset`:

```sh
pnpm --filter @blood/api exec tsx ../../scripts/provision-demo-accounts.ts --reset
```

`--reset` xóa đúng 4 email trong `DEMO_LOGIN_ACCOUNTS` (không đụng tài khoản khác), rồi tạo lại trong cùng lần chạy. Role/user-role và auth session xóa theo (cascade); audit log giữ lại với actor rỗng (`SetNull`). Nếu một tài khoản demo đã có dữ liệu nghiệp vụ (đăng ký, phân công campaign, thông báo, check-in/sàng lọc/hiến máu) script sẽ **dừng và báo rõ**, không tự xóa. Không kết hợp `--reset` với `--verify` trong một lần chạy.

Lệnh `--verify` kiểm tra login, role, quyền đọc campaign rồi logout để đóng phiên test qua API đang chạy. Không in token, cookie hoặc hash mật khẩu.

`--verify` đã chạy trên API local (26/09/2026) và đối chiếu tập quyền trả về với `ROLE_PERMISSIONS` (`@blood/shared-types`): DONOR 15 quyền, DONATION_STAFF 25, COORDINATOR 19, SYSTEM_ADMIN 16 — login/role/quyền đều khớp. Script so khớp cả ma trận quyền của role (không hard-code một permission), vì `SYSTEM_ADMIN` không có `campaign.read` — quyền campaign thuộc DONOR/DONATION_STAFF/COORDINATOR.
