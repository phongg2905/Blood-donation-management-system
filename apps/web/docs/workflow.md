# Workflow hiến máu (FE, mock)

Luồng nghiệp vụ: Campaign → Registration → Check-in → Screening → Blood Bag →
Certificate / Donor History.

Phần này **chỉ FE**. Backend chưa có API cho các luồng trên, nên toàn bộ dữ
liệu chạy qua mock trong `src/features/workflow/`. Không sửa `apps/api/**`,
Prisma, seed, shared types hay hợp đồng API.

## Route và quyền

| Route | Màn hình | Permission | Actor |
| --- | --- | --- | --- |
| `/donor/register` | Đăng ký 5 bước + QR | `registration.create` | DONOR |
| `/donor/history` | Lịch sử + đăng ký sắp tới | `donation.read` | DONOR |
| `/donor/certificates` | Danh sách chứng nhận | `certificate.read` | DONOR |
| `/donor/certificates/:certificateId` | Chi tiết chứng nhận | `certificate.read` | DONOR |
| `/clinic/check-in` | Tiếp nhận / check-in | `registration.checkin` | DONATION_STAFF |
| `/clinic/screening` | Hàng chờ sàng lọc | `screening.review` | DONATION_STAFF |
| `/clinic/screening/:registrationId` | Phiếu sàng lọc | `screening.review` | DONATION_STAFF |
| `/clinic/blood-bags` | Danh sách túi máu | `bloodbag.read` | DONATION_STAFF |
| `/clinic/blood-bags/new` | Gắn mã túi máu | `bloodbag.create` | DONATION_STAFF |

Nav hiển thị theo cả permission **và** actor: DONATION_STAFF cũng có
`donation.read`/`certificate.read` nhưng các màn hình lịch sử/chứng nhận là của
chính DONOR, nên `NavItem` có thêm trường `roles`.

### Điểm vào đăng ký (gắn với đợt hiến)

Đăng ký mở từ chính đợt hiến: nút **Đăng ký hiến máu** trên danh sách
(`/campaigns`) và trên chi tiết đợt hiến trỏ tới
`/donor/register?campaign=<id>`. Hai nút chỉ hiện khi có `registration.create`
(chỉ DONOR) và đợt đang `OPEN`.

Trang đăng ký đọc `?campaign=<id>`, chọn sẵn đợt và vào thẳng bước chọn khung
giờ; nút **Đổi đợt hiến** quay về bước chọn đợt. Nếu tham số trỏ tới đợt không
mở đăng ký, trang ở lại bước chọn đợt kèm thông báo. Vì vậy DONOR **không** có
mục menu "Đăng ký hiến máu" riêng — đợt hiến là điểm vào duy nhất, tránh hai
nơi cùng liệt kê đợt hiến.

## Mock

- `VITE_USE_MOCK_WORKFLOW` — mặc định bật trong development; đặt `false` để tắt.
  `VITE_WORKFLOW_MOCK_LATENCY` chỉnh độ trễ (mặc định 250ms).
- `mock-repository.ts` là store in-memory, reset khi tải lại trang. Ngoài dev,
  repository API trả lỗi 503 (`ROUTE_NOT_FOUND`) để UI hiện trạng thái "chưa hỗ
  trợ" thay vì dữ liệu giả.
- Dữ liệu minh họa gồm 6 đăng ký trải các trạng thái để có hàng chờ check-in và
  sàng lọc; DONOR được seed 2 lần hiến quá khứ khi mở lịch sử/chứng nhận lần đầu.

## Quy tắc đã tuân thủ

- Trạng thái dùng đúng enum của `@blood/shared-types`
  (`REGISTRATION_STATUSES`, `SCREENING_STATUSES`, `BLOOD_BAG_STATUSES`,
  `CERTIFICATE_STATUSES`). Không thêm trạng thái mới.
- Check-in không có trạng thái riêng: đánh dấu `checkedInAt` và tạo phiếu sàng
  lọc `PENDING`. Sàng lọc đi theo `PENDING → WAITING_REVIEW →
  ELIGIBLE/INELIGIBLE/DEFERRED`; `INELIGIBLE`/`DEFERRED` bắt buộc có lý do.
- Khai báo sức khỏe chỉ ghi nhận câu trả lời, **không** tự suy diễn ngưỡng y tế.
  Chỉ nhân viên kết luận đủ/không đủ điều kiện.
- Màn hình túi máu chỉ quản lý túi (mã, thể tích, nhóm máu, trạng thái). Không có
  timer/thao tác lấy máu theo yêu cầu.
- Chứng nhận là mock, không phải chứng nhận thật, không chữ ký số.
- QR trong trang xác nhận/chứng nhận là **placeholder minh họa, không quét
  được** (dự án chưa cài thư viện tạo QR); mã đăng ký được in kèm để dùng thủ công.
- STYLE/UX dùng lại component và token hiện có (`Button`, `Input`, `FormField`,
  `Checkbox`, `QueryState`, `Feedback`, `ConfirmDialog` của feature campaign).

## Chức năng đang chờ API BE

Khi BE bàn giao, chỉ thay `ApiWorkflowRepository` trong `repository.ts` và map
DTO; UI/component không đổi. Cần:

1. `POST /registrations` + health declaration; kiểm tra trùng, sức chứa khung
   giờ, cửa sổ đăng ký.
2. `GET /registrations/me`, `GET /registrations?code|identity|phone` (tra cứu quầy).
3. `POST /registrations/:id/check-in`.
4. `GET /screenings?status=...`, `POST/PATCH` chỉ số và kết luận sàng lọc (kèm lý
   do bắt buộc).
5. `GET/POST /blood-bags` (gắn túi theo đăng ký đủ điều kiện).
6. `GET /donations/history` (hoặc endpoint tương đương) cho lịch sử người hiến.
7. `GET /certificates`, `GET /certificates/:id`.

### Ghi nhận cần BE xác nhận

- CCCD (`donorIdentity`) chưa được thu thập ở bước đăng ký tự phục vụ. Tra cứu
  check-in theo CCCD hiện chỉ đúng với dữ liệu seed; cần thống nhất trường CCCD
  trong hồ sơ người hiến.
- Ánh xạ check-in sang trạng thái đăng ký: enum hiện tại không có
  `CHECKED_IN`/`WAITING_SCREENING`. FE đang dùng `checkedInAt` + phiếu sàng lọc
  `PENDING`; nếu BE muốn trạng thái đăng ký riêng thì cần bổ sung vào
  `@blood/shared-types` (do BE quyết định, FE không tự thêm).
