# PHASE 3 FE — API INTEGRATION CHECKLIST

## Rà soát trước commit sau migration role (23/09/2026)

- Shared build, web typecheck/lint/build: PASS; web tests: **12 files, 145 tests PASS**.
- Lint toàn workspace: PASS. Kiểm tra code API production bằng `pnpm --filter @blood/api exec tsc -p tsconfig.json --noEmit`: PASS.
- `pnpm --filter @blood/api typecheck`: **FAIL** ở `src/phase1.test.ts:93`: helper nhận `RoleCode` (actor + legacy) nhưng truy cập ma trận `ROLE_PERMISSIONS` chỉ dành cho legacy.
- Test role Phase 1 còn kỳ vọng `isRoleCode('COORDINATOR') === false`, không còn phù hợp với actor model mới. Cần cập nhật test BE sau khi được xác nhận; chưa sửa file `apps/api/**` trong đợt rà soát này.
- Các kết quả ở mục bàn giao Phase 3 bên dưới là lịch sử trước migration role; không đại diện cho trạng thái typecheck toàn workspace hiện tại.
- Script cấp tài khoản demo chỉ được rà soát mã, không chạy hoặc thay dữ liệu DB trong đợt rà soát này. `.env` local không nằm trong commit.

## Kết quả kiểm chứng ngày 23/09/2026

- Frontend suite: **12 files, 144 tests passed** (126 test hiện có + 18 test Phase 3: UI/domain và mocked transport).
- `pnpm lint`: pass toàn workspace, không warning/error.
- `pnpm typecheck`: pass toàn workspace, bao gồm shared packages, API và web.
- `pnpm --filter @blood/web build`: pass; fixture campaign mock không xuất hiện trong production bundle.
- Chrome headless: **30/30 kiểm tra responsive** (6 route × 1440/1024/768/390/320px), không tràn ngang, các control có label; Tab/Escape/focus restore dialog đạt, không console errors. Đã xem screenshot mobile để kiểm tra bố cục.
- Test refresh/session/profile và ProtectedRoute hiện có vẫn đạt. Browser QA tải trực tiếp/refresh từng route bằng phiên mock auth. Không thử real API Phase 3, không chạy integration mutation trên DB.
- Backend/shared contracts và các thay đổi auth có sẵn trước task được giữ nguyên. Không stage/commit hay triển khai Phase 4.

## Phạm vi và nguồn đối chiếu

Frontend Campaign, TimeSlot và CampaignStaff được triển khai độc lập với API Phase 3. Không sửa backend, Prisma, seed, shared types/validation hoặc tài liệu hợp đồng BE. Không triển khai Registration/HealthDeclaration/booking/waitlist hay workflow Phase 4.

Nguồn đã đối chiếu: `packages/shared-types/src/index.ts`, `packages/shared-validation/src/index.ts`, `apps/api/prisma/schema.prisma`, validation campaign/time-slot của API, `docs/api/frontend-contract.md`. URL campaign/time-slot bên dưới đã được tài liệu BE định nghĩa nhưng **chưa có HTTP implementation** tại thời điểm bàn giao. Staff chưa có hợp đồng HTTP; không tự đặt URL.

## Chạy development và QA

Trong `.env` local, đặt `VITE_USE_MOCK_CAMPAIGNS=true`, sau đó khởi động lại Vite. Biến này độc lập với `VITE_USE_MOCK_API` của auth: có thể dùng đăng nhập thật và dữ liệu campaign mock. Để QA hoàn toàn độc lập với BE, opt-in mock auth bằng cấu hình hiện có. Không thay tài khoản hay quyền người dùng trong UI.

- `VITE_CAMPAIGN_MOCK_SCENARIO=success|empty|error`.
- `VITE_CAMPAIGN_MOCK_LATENCY=300` (ms; tăng để kiểm tra loading).
- Mock campaign chỉ được chọn khi `import.meta.env.DEV`; production dùng API dù biến mock là true.
- Banner ghi rõ dữ liệu minh họa. Mock lưu trong bộ nhớ, thay đổi mất khi tải lại; URL filter vẫn giữ nguyên. Không dùng mock như dữ liệu thật.
- Fixtures có cả năm trạng thái, đợt hiện tại/sắp tới/đã qua, slot đang hoạt động/ngừng hoạt động, campaign không có slot, nhân sự đã/chưa phân công.

Lệnh: `pnpm --filter @blood/web test`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter @blood/web build`.

QA Chrome có thể chạy bằng `node apps/web/scripts/qa-phase3.mjs`. Script tự bật mock riêng trong tiến trình, dùng Vite port 5198 và Chrome headless port 9446; `CHROME_PATH` ghi đè đường dẫn Chrome. Script kiểm tra 6 route × 5 viewport, nhãn input, Tab/Escape/phục hồi focus dialog, console errors; lưu screenshot/report ngoài project tại `../.qa-phase3`. Không ghi cấu hình `.env`.

## Routes và UI

| Route                              | Màn hình                                                              | Quyền route                             |
| ---------------------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| `/campaigns`                       | Danh sách, tìm tên/địa điểm, lọc trạng thái/ngày, sắp xếp, phân trang | `campaign.read`                         |
| `/campaigns/:campaignId`           | Chi tiết, lifecycle, danh sách khung giờ                              | `campaign.read`                         |
| `/campaigns/new`                   | Tạo bản nháp                                                          | `campaign.read` + `campaign.create`     |
| `/campaigns/:campaignId/edit`      | Chỉnh sửa bằng cùng CampaignForm                                      | `campaign.read` + `campaign.update`     |
| `/campaigns/:campaignId/timeslots` | Danh sách/tạo/sửa/ngừng hoạt động slot                                | `campaign.read` + `timeslot.read`       |
| `/campaigns/:campaignId/staff`     | Danh sách/tìm/phân công/gỡ nhân sự                                    | `campaign.read` + `campaign_staff.read` |

Tất cả nằm trong ProtectedRoute và RoleLayout hiện có. Mỗi action kiểm tra permission tương ứng từ `CurrentUser.permissions`; không suy từ tên role. Người chỉ có quyền đọc slot không thấy nút quản lý. Các role chỉ dùng để hiển thị nhãn nhân sự. API vẫn phải thực thi authorization và phạm vi dữ liệu ở server.

Components chính: `CampaignListPage`, `CampaignDetailPage`, `CampaignCreatePage`, `CampaignEditPage`, `CampaignForm`, `TimeSlotPage`, `TimeSlotList`, `SlotForm`, `CampaignStaffPage`, `CampaignShell`, `StatusBadge`, `QueryState`, `Feedback`, `ConfirmDialog`. `campaigns.css` dùng design tokens hiện có. Navigation thêm link campaign; Landing giữ bố cục, đọc đợt OPEN sắp tới qua repository và nối CTA sang list/detail. Registration vẫn hiển thị thông báo sắp ra mắt.

## Service và trạng thái bất đồng bộ

`Component → useCampaignQuery/useCampaignMutation → CampaignRepository → MockCampaignRepository | ApiCampaignRepository`.

- Model và interface: `src/features/campaigns/types.ts`.
- Mock của **mọi method** trong bảng tiếp theo: `src/features/campaigns/mock-repository.ts`.
- Adapter HTTP, resolver, mapper và injection context: `src/features/campaigns/repository.ts`.
- Query dùng custom hooks theo stack hiện có, không cài thêm thư viện. Key bao gồm route/filter và session permissions; bỏ qua response cũ sau đổi route/query/session. Không cache lâu dài; mutation đọc lại dữ liệu liên quan. Trở lại list/detail/landing sẽ query lại.
- Mỗi query có loading, error và retry; list/slot/staff/search có empty riêng. Mutation có synchronous lock chống double-submit, disabled/loading, feedback thành công và lỗi.
- Error adapter dùng `ApiRequestError` hiện có, xử lý 400/401/403/404/409/503 và lỗi mạng; không render message kỹ thuật từ API. Server field errors được gắn vào field tương ứng.
- Form create/edit dùng chung. Validation tập trung trong `domain.ts` vì shared-validation hiện **chỉ có UUID validators**, không có campaign/slot validators để import. FE phản ánh rule server đã có; không import code server vào bundle.
- Thời gian truyền UTC ISO; nhập/hiển thị theo timezone trình duyệt với nhãn rõ ràng. Không giả định timezone nghiệp vụ. Date-only filter mock tính cả ngày theo timezone trình duyệt.
- Unsaved: nút Hủy có dialog xác nhận và beforeunload cho reload/đóng tab. Chưa chặn link nội bộ/back router vì BrowserRouter hiện không có blocker; không thay kiến trúc router.
- Dialog dùng native `<dialog>` và explicit Tab loop, nền inert, Escape, focus restore. Form focus field lỗi đầu tiên. Feedback dùng status/alert.

## Model FE đang chờ DTO thật

Các enum status/permission/role và `PaginationMeta` được tái sử dụng từ shared-types, không định nghĩa lại.

```ts
CampaignInput = {
  name: string; location: string;
  description: string | null; organizerName: string | null;
  contactPhone: string | null;
  startsAt: string; endsAt: string; // UTC ISO
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  targetDonors: number | null; targetBloodVolumeMl: number | null;
};
Campaign = CampaignInput & { id: string; status: CampaignStatus };
SlotInput = { startsAt: string; endsAt: string; capacity: number; label: string | null };
TimeSlot = SlotInput & { id: string; campaignId: string; isActive: boolean };
StaffCandidate = { id: string; fullName: string; email: string; roles: RoleCode[] };
CampaignStaff = {
  id: string; campaignId: string; userId: string;
  assignment: 'CHECK_IN' | 'SCREENING' | 'COLLECTION' | 'SUPPORT' | null;
  user: StaffCandidate;
};
Page<T> = { items: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };
```

CampaignAssignment khớp Prisma; chưa có export tương ứng trong shared-types nên được giữ ở feature layer. Nhân sự cần projection user để hiển thị; đây là nhu cầu FE, **không phải xác nhận BE đã trả projection này**. Không có số chỗ còn lại trong model; UI ghi rõ capacity là sức chứa.

## Danh sách API cần bàn giao

Tất cả response HTTP campaign/slot đi qua envelope chuẩn `{ success: true, data }`; list thêm `meta`. Repository trả FE models ở trên. Không coi những kiểu FE này là DTO BE đã được duyệt.

| FE method                              | Request FE                                      | Response FE            | Consumer                         | Adapter/URL đã có trong tài liệu BE            |
| -------------------------------------- | ----------------------------------------------- | ---------------------- | -------------------------------- | ---------------------------------------------- |
| `list(query)`                          | `{ search?, status?, from?, to?, sort?: 'asc'   | 'desc', page, limit }` | `Page<Campaign>`                 | CampaignListPage, CampaignSection              | GET `/campaigns`; map `data` sang `items`, bắt buộc `meta` |
| `detail(id)`                           | campaign ID                                     | `Campaign`             | Detail/Edit/TimeSlot/Staff pages | GET `/campaigns/:id`, `mapCampaign`            |
| `create(input)`                        | `CampaignInput`                                 | `Campaign`             | CampaignForm create              | POST `/campaigns`, `mapCampaign`               |
| `update(id,input)`                     | ID + `CampaignInput`                            | `Campaign`             | CampaignForm edit                | PATCH `/campaigns/:id`, `mapCampaign`          |
| `transition(id,'open')`                | ID, không body                                  | `Campaign`             | CampaignDetail                   | POST `/campaigns/:id/open`                     |
| `transition(id,'close')`               | ID, không body                                  | `Campaign`             | CampaignDetail                   | POST `/campaigns/:id/close`                    |
| `transition(id,'cancel')`              | ID, không body; reason hiện optional ở tài liệu | `Campaign`             | CampaignDetail                   | POST `/campaigns/:id/cancel`                   |
| `slots(campaignId)`                    | ID, lấy tất cả slot                             | `TimeSlot[]`           | TimeSlotList ở detail/management | GET `/campaigns/:id/time-slots`, `mapSlot`     |
| `createSlot(campaignId,input)`         | ID + `SlotInput`                                | `TimeSlot`             | SlotForm create                  | POST `/campaigns/:id/time-slots`               |
| `updateSlot(id,input)`                 | slot ID + `SlotInput`                           | `TimeSlot`             | SlotForm edit                    | PATCH `/time-slots/:id`                        |
| `deactivateSlot(id)`                   | slot ID, không body                             | `TimeSlot`             | TimeSlotList                     | POST `/time-slots/:id/deactivate`              |
| `staff(campaignId)`                    | campaign ID                                     | `CampaignStaff[]`      | CampaignStaffPage                | Chưa có URL; inject `StaffAdapter.staff`       |
| `searchStaff(campaignId,search)`       | campaign ID + chuỗi tìm tên/email               | `StaffCandidate[]`     | Form phân công                   | Chưa có URL; inject `StaffAdapter.searchStaff` |
| `assign(campaignId,userId,assignment)` | 2 ID + assignment hoặc null                     | `CampaignStaff`        | Form phân công                   | Chưa có URL; inject `StaffAdapter.assign`      |
| `unassign(campaignId,id)`              | campaign ID + assignment record ID              | `void`                 | Dialog gỡ phân công              | Chưa có URL; inject `StaffAdapter.unassign`    |

Mỗi method trên có implementation cùng tên trong `MockCampaignRepository`. Khi API có, chỉ sửa `ApiCampaignRepository`, `mapCampaign`, `mapSlot`, bổ sung StaffAdapter và chọn adapter qua resolver/context. Không gọi fetch trong component. Transport dùng `services/api.ts` hiện có, bao gồm token memory, refresh single-flight và retry 401.

## Contract cần BE xác nhận trước integration thật

1. Campaign/TimeSlot response đầy đủ, nullable/optional fields và cơ chế xóa giá trị optional (FE gửi null); response mutation có trả đầy đủ model để đọc lại không.
2. Campaign list hiện tài liệu chỉ có `status/from/to/page/limit`. `search` và `sort` là nhu cầu FE, mock hỗ trợ; mapping HTTP hiện giữ tên FE nhưng **chưa có bảo đảm BE hỗ trợ**. Chốt query names, default ordering, search semantics và pagination. Không lọc riêng một trang response để giả vờ tìm toàn bộ dữ liệu.
3. `from/to`: giới hạn ngày hay instant, inclusive/exclusive, timezone nghiệp vụ và filter dựa startsAt hay giao khoảng. Mock dùng startsAt và inclusive ngày; BE cần thống nhất trước triển khai thật.
4. Phạm vi campaign/status theo người dùng, bao gồm donor có thấy DRAFT/CANCELLED không. Mock hiển thị theo quyền đọc và bộ lọc, không giả lập row-level policy chưa được định nghĩa. BE phải lọc dữ liệu ở server.
5. Staff: URL, method HTTP, envelopes, user projection, quyền tìm ứng viên (`campaign_staff.assign` hay thêm `user.read`), eligible roles/isActive, pagination tìm kiếm, record ID dùng để remove, duplicate/conflict error. FE không invent role/quyền mới. Không dùng GET users như một API staff đã được xác nhận.
6. Assignment có bị ràng buộc với role không; bốn nhiệm vụ lấy từ Prisma. Mock không tự đặt quy tắc role–assignment khi chưa có business rule.
7. Có transition `CLOSED → COMPLETED` trong shared state machine nhưng không có `campaign.complete` permission/endpoint. UI hiển thị COMPLETED/frozen nhưng không tự tạo action hoàn tất hoặc mượn quyền close/update.
8. Slot overlap/duplicate, sửa thời gian campaign khi đã có slot, giảm capacity thấp hơn occupancy, sửa slot/campaign khi closed/cancelled và quyền reactivate chưa có rule/endpoint được công bố. Không tự cấm/chấp thuận những rule mới như BE đã hỗ trợ; mock chỉ áp dụng rule hiện có (range, capacity, state transition/frozen campaign).
9. Limits/validation cho organizerName/contactPhone/description/label chưa có rule đầy đủ; UI không tự đặt regex hoặc giới hạn không có nguồn. API phải bàn giao field errors khi thêm constraints.

## Trình tự thay mock bằng API

1. BE xác nhận các mục trên và triển khai endpoint đã tài liệu hóa.
2. Map DTO request/response và query trong adapter; map staff projection và errors. Nếu response mutation thiếu dữ liệu, adapter có thể đọc lại detail trước khi trả FE model.
3. Inject StaffAdapter thật; tắt `VITE_USE_MOCK_CAMPAIGNS`; giữ authentication architecture hiện tại.
4. Chạy integration với token thật, 401 refresh/403/404/409/400 field errors, pagination toàn tập dữ liệu, null clearing, timezone và quyền theo chiến dịch; chạy lại test/browser QA.

UI được tách khỏi transport/mock; đổi endpoint và DTO không yêu cầu rewrite component. Không thể cam kết không sửa UX nếu BE/PM thay đổi business rules hoặc từ chối các khả năng FE đang chờ xác nhận. Unit/browser mock tests không chứng minh real API integration hay toàn hệ thống đã hoàn tất.
