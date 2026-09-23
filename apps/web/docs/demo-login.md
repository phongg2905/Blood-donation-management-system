# Tài khoản demo local

Đã tạo 4 tài khoản trong database local; đăng nhập qua API auth hiện có, không bypass RBAC. Không tạo/sửa tài khoản donor và không thay schema, seed hay ma trận quyền.

| Vai trò | Email |
| --- | --- |
| Quản trị viên | `admin.demo@example.local` |
| Nhân viên tiếp nhận | `reception.demo@example.local` |
| Nhân viên y tế | `medical.demo@example.local` |
| Nhân viên lấy máu | `collection.demo@example.local` |

Mật khẩu demo chung: `Demo@Password1`. Đây là tài khoản thử nghiệm local với credential công khai, không dùng cho dữ liệu production.

## Chọn trên login

Mở **Tài khoản demo**, chọn vai trò, rồi nhấn **Đăng nhập**. Mục phụ trợ chỉ điền form, không tự đăng nhập, không đổi auth adapter và không sửa quyền. Các nút bị khóa trong lúc đang đăng nhập.

Chỉ hiển thị trong Vite development, mặc định bật. Đặt `VITE_SHOW_DEMO_LOGIN=false` trong `.env`, khởi động lại Vite để ẩn. Production không import component/credential demo này. Nếu chủ động bật mock auth (`VITE_USE_MOCK_API=true`), picker dùng 4 tài khoản mock có sẵn và mật khẩu mock tương ứng; tài khoản API thật không bị đổi.

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

Lệnh `--verify` kiểm tra login, role, quyền đọc campaign rồi logout để đóng phiên test qua API đang chạy. Không in token, cookie hoặc hash mật khẩu.

Đã xác minh API thật cho cả bốn: ADMIN 53 quyền, RECEPTION_STAFF 10, MEDICAL_STAFF 14, BLOOD_COLLECTION_STAFF 18 tại thời điểm tạo.
