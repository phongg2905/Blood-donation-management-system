# Frontend Phase 2.5

## Phạm vi

Giữ React 19, React Router 7, AuthProvider, API adapter và CSS tokens hiện có.
Không thay backend, shared contract, database, role, permission hoặc cài thư viện.
Không triển khai nghiệp vụ Phase 3.

## Audit và thay đổi

- Profile trước đây mở sẵn form sửa, lặp lại thông tin tài khoản và hiện danh
  sách raw permission. Nay mặc định chỉ xem; có avatar, tên, email, vai trò
  tiếng Việt và thông tin liên hệ của người hiến. Giá trị thiếu hiện “Chưa cập nhật”.
- Nút “Chỉnh sửa thông tin” kiểm tra quyền update nội bộ. Form inline chỉ mount
  khi chọn sửa; email readonly. Hủy unmount bản nháp, khôi phục dữ liệu khi mở
  lại; lưu thành công cập nhật AuthProvider và quay về read mode, có feedback.
- Giữ nguyên PATCH /auth/me: người hiến gửi fullName/phone/address; staff/admin
  chỉ gửi fullName. Khi lỗi giữ bản nháp. Lúc lưu khóa Save/Cancel và các ô sửa.
- Focus chuyển vào tên khi sửa, vào trường không hợp lệ khi validation lỗi và
  trở về nút sửa khi đóng form. Labels truyền required tới input thật.
- Gỡ PermissionsPanel, SystemStatusPage, MockAccountsPanel và CSS tương ứng
  khỏi presentation layer; không dùng CSS để che debug. Health API và mock
  service phục vụ test vẫn còn nguyên.
- Gỡ raw error code, đường dẫn nội bộ trên 404 và liên kết devResetToken.
  Lỗi chưa được ánh xạ dùng thông báo tiếng Việt an toàn; HTTP 429 có copy riêng.
- Header có Trang chủ, Hồ sơ theo quyền, menu tài khoản gọn với Hồ sơ/Đăng xuất,
  hỗ trợ Escape và focus. Thêm skip link; sửa hierarchy nút 403/404, spacing
  mobile, password toggle và reduced-motion.

## Home và routing

- `/` là authenticated Home trong ProtectedRoute và RoleLayout hiện có.
- Login/register bình thường dẫn về `/`; vào `/login` khi đã đăng nhập dẫn về
  Home. Giữ hành vi quay lại deep link an toàn khi người dùng chủ động mở một
  protected page trước đăng nhập. Logout về `/login`.
- Cơ chế refresh/access token/HttpOnly cookie không thay đổi.
- `/system-status` không còn là route ứng dụng, trả trang 404. Kiểm tra kỹ thuật
  dùng `GET /api/health`, không đưa thông tin database vào màn hình người dùng.
- Home gồm greeting cá nhân hóa, hero, quick links, hành trình 5 bước, impact,
  khu vực đợt hiến máu sắp ra mắt và CTA cuối trang.
- Phần trình bày của Home sau đó được thay bằng bản editorial trong
  [landing-redesign.md](./landing-redesign.md). Hành vi phase 2.5 (route, phân
  quyền, nguồn dữ liệu, nút đăng ký disabled) giữ nguyên.
- Campaign/registration chưa có endpoint nghiệp vụ trong router BE hiện tại.
  Nút đăng ký disabled có giải thích; xem đợt hiến dẫn tới section cùng trang.
  Các phần này kiểm tra permission nội bộ. Không tạo số liệu, chiến dịch hoặc
  trang lịch/lịch sử giả; không gọi API chưa tồn tại.
- Tái sử dụng ảnh local auth-blood-donation.png; không có dependency Pinterest.
  Link reference Pinterest không truy cập được trong phiên thực hiện; thiết kế
  dựa trên mô tả editorial, bố cục bất đối xứng và design tokens của project.

## File thêm/sửa/xóa

Thêm:

- `src/app/pages/HomePage.tsx` — các section nhỏ trong cùng module theo cấu trúc app/pages.
- `src/app/styles/home.css`.
- `src/app/router/phase25.test.tsx` — regression cho profile, routing và cleanup.
- `docs/phase-2.5.md` — báo cáo này.

Sửa:

- `src/App.tsx`, `src/app/router/AppRoutes.tsx`.
- `src/features/auth/routing.ts`, `navigation.ts`, `auth-errors.ts`.
- `src/features/auth/pages/{Login,Register,ForgotPassword,ResetPassword,Forbidden,NotFound}Page.tsx`.
- `src/features/auth/guards/{ProtectedRoute,PermissionGuard}.tsx`.
- `src/features/auth/components/ErrorPage.tsx`.
- `src/features/profile/pages/ProfilePage.tsx`, `src/layouts/AppShell.tsx`.
- `src/components/ui/{Button,FormError,FormField}.tsx`.
- `src/app/styles/{app,auth,base,global}.css`.
- Test hiện có: `AppRoutes.test.tsx`, `routing.test.ts`, `guards.test.tsx`, `auth-pages.test.tsx`.
- `docs/backend-integration.md`, README root (hướng dẫn UI hiện hành).

Xóa: `src/app/pages/SystemStatusPage.tsx`,
`src/features/auth/components/MockAccountsPanel.tsx`.

## Kiểm chứng

- `pnpm lint`: đạt toàn workspace; Prettier check các file source thay đổi và
  `git diff --check` đạt.
- `pnpm typecheck`: đạt toàn workspace.
- `pnpm build`: đạt toàn workspace.
- `pnpm test`: 120 frontend test và 53 backend test đạt; backend test dùng
  PostgreSQL thật. Các diagnostic xuất ra trong negative tests là kỳ vọng.
- Chromium headless: Home ở 1440, 1200, 1024, 768, 720, 390, 320px; Profile ở
  1440, 768, 390, 320px; Login/Register/Forgot/Reset/403/404 ở 1440, 390, 320px.
  Không horizontal overflow; đã xem ảnh desktop/mobile của Home và Profile.
- Browser kiểm tra login → Home, refresh, authenticated login redirect,
  Profile view/edit/cancel/save, menu Escape, logout, chặn Home khi chưa login.
  Không có JavaScript exception hoặc console error mới trong kịch bản; HTTP
  401 từ fixture chưa đăng nhập là kỳ vọng.
- Browser dùng API response fixture cô lập qua Playwright; không đưa mock vào
  production. Test này không xác nhận cookie SameSite/Secure/CORS hoặc email
  SMTP thật. Backend/API adapter có bộ test riêng; không thay thế E2E production.

## Phần còn lại

Kết nối Campaign/Registration, lịch và lịch sử hiến khi phase nghiệp vụ được
triển khai. Không tự thêm chúng trong Phase 2.5. Kiểm thử browser tích hợp API
thật và gửi email thật vẫn cần môi trường tích hợp phù hợp.
