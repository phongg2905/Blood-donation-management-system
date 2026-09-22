# Design references (UI inspiration only)

Thư mục này là **nơi lưu UI/template/reference** (ảnh chụp, mockup, screenshot từ
Pinterest/Dribbble, template HTML mẫu…) để tham khảo khi dựng giao diện Phase 2+.

## Quy tắc bắt buộc

- ❌ **Không import trực tiếp** bất kỳ file nào trong `design-references/` vào
  production code. Không có ngoại lệ.
- ❌ **Không copy pixel-to-pixel.** Đây là tài liệu tham khảo, không phải nguồn code.
- ✅ Chỉ dùng để tham khảo **layout, spacing, màu sắc, component style**.
- ✅ Asset dùng thật trong production **phải** nằm trong `src/assets/` hoặc `public/`.
  Muốn dùng một hình trong này thì **copy** nó sang `src/assets/` (đã tối ưu) rồi
  import từ đó.

Thư mục này nằm ngoài `src/`, không nằm trong `tsconfig.include`
(`["src", "vite.config.ts"]`), nên code trong đây **không được typecheck và không
được bundle**. Đó là chủ ý — nó là tài liệu, không phải module.

## Cấu trúc

| Folder        | Dùng cho                                                            |
| ------------- | ------------------------------------------------------------------- |
| `auth/`       | Đăng nhập, đăng ký, quên/đặt lại mật khẩu, xác thực email           |
| `dashboard/`  | Dashboard theo role, thẻ thống kê, chart, màn hình tổng quan        |
| `forms/`      | Form nhập liệu: khai báo sức khỏe, sàng lọc, campaign, time slot    |
| `tables/`     | Bảng danh sách, filter, phân trang, empty state, bulk action        |
| `navigation/` | Header, sidebar, menu theo role, breadcrumb, tab, stepper           |
| `misc/`       | Mọi thứ chưa xếp loại: 404, loading/skeleton, toast, modal, ảnh nền |

## Cách dùng

1. Bỏ file tham khảo vào đúng folder con (`auth/`, `dashboard/`, …).
2. Đặt tên mô tả nội dung, ví dụ `staff-checkin-search-bar.png`.
3. Khi triển khai UI thật, **không** copy nguyên file — chuyển ý tưởng thành
   component trong `src/components/ui/` hoặc `src/features/<feature>/components/`.

## Lưu ý bản quyền

Ưu tiên dùng reference để rút ra **nguyên tắc thiết kế** (nhịp spacing, hệ màu,
cách sắp xếp) thay vì sao chép tài sản của bên khác. Không đưa asset có bản quyền
vào build production.
