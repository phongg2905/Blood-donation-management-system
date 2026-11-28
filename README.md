# Hệ thống quản lý hiến máu

Ứng dụng full-stack quản lý đợt hiến máu, đăng ký và tờ khai y tế, check-in, sàng lọc, thu nhận túi máu, lịch sử hiến, chứng nhận, thông báo và quản trị. Phân quyền theo 4 vai trò: DONOR, DONATION_STAFF, COORDINATOR, SYSTEM_ADMIN.

## Tech stack

pnpm workspace, React 19 + TypeScript + Vite 7, Node.js + Express 5 REST API, Prisma 6.19, PostgreSQL 16, Docker Compose, ESLint và Prettier. Backend là modular monolith.

## Cấu trúc

```text
Blood donation management system/
├── apps/
│   ├── web/                 # Home, layouts, features, services
│   └── api/
│       ├── prisma/          # Schema và migrations
│       └── src/
│           ├── config/
│           ├── modules/     # Các domain, health và service xếp lịch nội bộ
│           ├── middlewares/
│           ├── common/
│           ├── database/seed/
│           ├── routes/
│           ├── app.ts
│           └── server.ts
├── packages/
│   ├── shared-types/
│   ├── shared-validation/
│   └── eslint-config/
├── docs/{requirements,database,api,uml}/
├── docker/                  # Dự phòng cấu hình hạ tầng
├── .env.example
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

Backend: Route → Controller → Service → Repository → Prisma → PostgreSQL. Module giao tiếp qua service công khai. Controller chỉ điều phối HTTP.
Các API nghiệp vụ dùng JWT, kiểm tra permission, quyền sở hữu đăng ký và phân công nhân sự theo đợt. Frontend bảo vệ route bằng ProtectedRoute và PermissionGuard.

## Yêu cầu

- Node.js 22.12 trở lên trong nhánh 22 LTS.
- pnpm 10.18.2.
- Docker Desktop đang chạy, sử dụng Linux containers.
- Cổng 3000, 5173 và 5432 còn trống.

Cài pnpm nếu chưa có:

```sh
npm install --global pnpm@10.18.2
```

Windows PowerShell chặn pnpm.ps1: dùng `pnpm.cmd` và `npm.cmd` tương ứng; không cần thay đổi ExecutionPolicy.

## Khởi động lần đầu

Mở terminal ngay tại root repository (thư mục chứa README này, package.json và docker-compose.yml). Toàn bộ lệnh bên dưới chạy trực tiếp ở đây.

Tạo environment ở **root monorepo**, không cần .env riêng trong từng app:

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```sh
cp .env.example .env
```

Sau đó:

```sh
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Migration đã có sẵn; Prisma sẽ áp dụng vào database trống theo thứ tự. Khi sửa schema, dùng `pnpm db:migrate --name ten_thay_doi`.
Migration `20260919000000_phase1_rbac_and_auth_sessions` gộp role cũ (`SCREENING_STAFF`, `DOCTOR` → `MEDICAL_STAFF`; `COORDINATOR` → `ADMIN`) và tạo bảng phiên đăng nhập/bặt lại mật khẩu.
Seed nền tảng RBAC bằng `pnpm db:seed` sau migration: 5 role, toàn bộ permission, mapping role-permission và (tùy chọn) tài khoản admin đầu tiên. Seed chạy lặp an toàn, không hard-code mật khẩu.

Trên Windows, dừng API bằng Ctrl+C trước khi chạy `db:generate` hoặc `db:migrate`.
API đang chạy có thể giữ khóa DLL Prisma, gây lỗi EPERM khi generate. Sau migration, chạy lại `pnpm dev`.

Frontend: http://localhost:5173  
Backend health: http://localhost:3000/api/health  
Base API: http://localhost:3000/api  
PostgreSQL: localhost:5432, database blood_donation, user postgres.

Root backend `/` trả 404 có chủ ý, vì chưa cung cấp route tại đó.

Chạy riêng hai terminal:

```sh
pnpm dev:api
pnpm dev:web
```

Shared packages được build tự động khi install và trước dev. Sau khi sửa shared source, chạy `pnpm build` hoặc khởi động lại `pnpm dev`.

## Environment và PostgreSQL

`.env.example` cung cấp giá trị local development, không dùng credentials này ở production.
`.env` đã được gitignore. Vite chỉ đưa biến có tiền tố VITE_ vào client; tuyệt đối không đặt secret dưới tiền tố đó.

- API_PORT: cổng Express, mặc định 3000.
- DATABASE_URL: kết nối Prisma; query timeout kết nối trong URL.
- CORS_ORIGIN: origin frontend được phép, mặc định http://localhost:5173.
- JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (tối thiểu 32 ký tự): bí mật ký access/refresh token. Cần đặt cả hai để chạy các luồng xác thực.
- ACCESS_TOKEN_TTL_MINUTES (mặc định 15) / REFRESH_TOKEN_TTL_DAYS (mặc định 30).
- ADMIN_EMAIL / ADMIN_PASSWORD (tùy chọn, mật khẩu tối thiểu 12 ký tự) / ADMIN_FULL_NAME: tạo tài khoản admin đầu tiên khi seed. Không có giá trị nào được hard-code trong source; nếu bỏ trống, seed sẽ bỏ qua bước này.
- POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB: khởi tạo PostgreSQL.
- POSTGRES_PORT: cổng host cho container.
- VITE_API_BASE_URL: mặc định /api; Vite proxy chuyển tới API_PORT.

Nếu 5432 đã bị chiếm, đổi **cả** POSTGRES_PORT và cổng trong DATABASE_URL sang cổng trống (ví dụ 5434). Không cần dừng database của project khác.
Nếu đổi user/password/database, cập nhật DATABASE_URL đồng bộ. Biến POSTGRES_* chỉ khởi tạo khi volume còn trống.

Compose dùng volume postgres_data và healthcheck pg_isready. `docker compose down` giữ dữ liệu; `docker compose down -v` xóa volume và dữ liệu.
Frontend/backend chạy trực tiếp trên máy để dễ debug.

## Kiểm tra

```sh
docker compose ps
pnpm db:deploy
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test
curl http://localhost:3000/api/health
curl http://localhost:5173/api/health
```

Trên Windows dùng `curl.exe` nếu curl là alias PowerShell.
`pnpm test` chạy test của API (cần PostgreSQL đang chạy) và test frontend (Vitest + jsdom, không cần database).
API test kiểm tra health, middleware, validation nghiệp vụ, constraint/quan hệ mới, tranh chấp capacity, cùng các test nền tảng Phase 1 (role/permission, state transition, khung giờ inactive/full, trùng lịch, campaign rule, screening/donation/certificate, envelope lỗi và hash mật khẩu). API tests rollback hoặc dọn đúng fixture của mình sau khi chạy.
Frontend test kiểm tra mock auth cho cả 5 role, ProtectedRoute, PermissionGuard, router, validation form và luồng login/register.
Trang `/` là Home dành cho người đã đăng nhập; khách chưa đăng nhập được chuyển tới `/login`.
Sau login/register, user đến Home; `/profile` mặc định chỉ xem và có nút chỉnh sửa.
Trang chẩn đoán `/system-status` và tài khoản demo đã được gỡ khỏi giao diện người dùng.
Kiểm tra hạ tầng bằng `GET /api/health` hoặc lệnh curl bên trên.
Frontend mặc định dùng API auth thật. `VITE_USE_MOCK_API=true` vẫn dành riêng cho phát triển giao diện độc lập; tài khoản fixture được khai báo trong mock service, không hiển thị trên UI.

Chi tiết frontend Phase 2.5: [Báo cáo UX/UI và kiểm thử](apps/web/docs/phase-2.5.md).
Art direction và cấu trúc trang chủ: [Landing editorial redesign](apps/web/docs/landing-redesign.md).

Vite proxy chỉ phục vụ development; khi triển khai build web cần reverse proxy /api hoặc cấu hình VITE_API_BASE_URL trước build.

## Commands

| Command                         | Công dụng                               |
| ------------------------------- | --------------------------------------- |
| pnpm dev                        | Chạy frontend + backend                 |
| pnpm dev:web / pnpm dev:api     | Chạy từng app                           |
| pnpm build                      | Build shared packages, API và web       |
| pnpm typecheck                  | Kiểm tra TypeScript strict              |
| pnpm lint                       | Kiểm tra ESLint                         |
| pnpm format / pnpm format:check | Format / kiểm tra Prettier              |
| pnpm test                       | Kiểm thử API, middleware và frontend    |
| pnpm db:generate                | Sinh Prisma Client                      |
| pnpm db:migrate                 | Migration development                   |
| pnpm db:deploy                  | Áp dụng migrations đã có                |
| pnpm db:seed                    | Seed 5 role, permission, mapping, admin |
| pnpm db:studio                  | Mở Prisma Studio                        |
| docker compose logs postgres    | Xem log PostgreSQL                      |
| pnpm --filter @blood/api start  | Chạy API sau build                      |

## Phase 1 đã chốt

Nền tảng backend Phase 1 đã hoàn tất: 5 role, ma trận permission, enum/status, state machine tập trung (BE enforce), business rule campaign/time slot/registration/check-in/screening/donation/blood bag/certificate, chuẩn hoá đơn vị và datetime, envelope thành công/lỗi/pagination thống nhất, error code dùng chung, chiến lược JWT + refresh token (bảng phiên chỉ lưu hash), seed idempotent và nền tảng AuditLog.

## Kiểm chứng luồng nghiệp vụ (25/11/2026)

`pnpm test` bao gồm test HTTP với PostgreSQL thật trong `apps/api/src/workflow.test.ts`:

- Tạo/sửa đợt hiến và khung giờ bằng ngày giờ JSON ISO; giữ được nhãn khung giờ; tìm kiếm đợt hiến.
- Đăng ký + tờ khai + giữ chỗ + thông báo nằm trong cùng một transaction. Hai yêu cầu tranh chấp chỗ cuối hoặc gửi trùng chỉ có một yêu cầu thành công. Đăng ký lại thất bại giữ nguyên tờ khai và trạng thái cũ.
- Chặn xem/đổi lịch/hủy đăng ký của người khác; check-in/sàng lọc/thu nhận phải đúng vị trí phân công. Lượt đã check-in không được hủy hoặc đánh dấu vắng mặt.
- Kết luận đủ điều kiện mới được thu nhận; tạm hoãn/không đủ điều kiện và khung giờ inactive được kiểm tra ở backend.
- Túi máu mới ở trạng thái COLLECTED, lưu thời điểm thu nhận và chuẩn hóa barcode. Chuyển trạng thái theo state machine; TESTED/ACCEPTED cần nhóm máu. Sửa thể tích cập nhật tổng lượt hiến, lịch sử và báo cáo. Không xóa túi cuối cùng của lượt hiến đã hoàn tất.
- API người dùng, túi máu và chứng nhận không trả passwordHash. File chứng nhận chỉ do chủ sở hữu hoặc nhân viên có certificate.issue cập nhật; chứng nhận thu hồi không được cập nhật file.
- Đầu vào UUID/status/body/phân trang sai trả lỗi validation. Các màn hình workflow tải đủ các trang dữ liệu và hiển thị lỗi API; cấu hình hệ thống không báo lưu thành công khi API thất bại.

Migration `20261125000000_add_screening_indicated_volume` bổ sung cột nullable còn thiếu. Chạy `pnpm db:deploy` khi cập nhật môi trường khác. Prisma CLI dùng DATABASE_URL khi không cấu hình DIRECT_URL riêng.

Test workflow tự dọn fixture theo UUID và giả lập gửi thông báo để không gửi email bên ngoài. SMTP thật, upload Supabase và vận hành production cần được kiểm tra riêng với cấu hình của môi trường đó. Giấy chứng nhận bản giấy/ảnh vẫn theo luồng hiện có; bước thu nhận không tự phát hành chứng nhận điện tử.

Lệnh `pnpm start` khởi động cả API đã build và Vite preview. Chạy `pnpm build` trước đó. Vite preview phục vụ kiểm tra local; triển khai production cần hosting/reverse proxy phù hợp.

Chi tiết: [Database](docs/database/README.md), [API](docs/api/README.md), [Frontend contract](docs/api/frontend-contract.md).
