# Refine blood donation domain

Schema hiện tại giữ 21 entity và toàn bộ quan hệ/RBAC cũ, đồng thời mở rộng thông tin nghiệp vụ. Migration `20260918090000_extend_donation_schema` bổ sung phần mở rộng mới nhất, tiếp nối `20260912035436_init` và `20260912070000_refine_blood_donation_domain`. Không reset, không xóa migration cũ. Mỗi môi trường cần áp dụng đủ migration để khớp schema.

## Enum

- Gender: MALE, FEMALE, OTHER.
- RegistrationStatus: thêm SCHEDULED (đã xếp lịch), WAITLISTED (chờ chỗ), NO_SHOW (không đến); giữ các giá trị cũ.
- ScreeningStatus: thêm WAITING_REVIEW (chờ kết luận), DEFERRED (tạm hoãn).
- BloodBagStatus: CREATED, COLLECTED, PENDING_TEST, TESTED, ACCEPTED, REJECTED, DISCARDED; mặc định CREATED.
- CertificateStatus: ACTIVE, REVOKED; mặc định ACTIVE.
- BloodType: A_POSITIVE, A_NEGATIVE, B_POSITIVE, B_NEGATIVE, AB_POSITIVE, AB_NEGATIVE, O_POSITIVE, O_NEGATIVE.
- CampaignAssignment: CHECK_IN, SCREENING, COLLECTION, SUPPORT.
- DonationType: WHOLE_BLOOD, PLASMA, PLATELETS; mặc định WHOLE_BLOOD.
- BloodComponent: WHOLE_BLOOD, RED_BLOOD_CELLS, PLASMA, PLATELETS; mặc định WHOLE_BLOOD.
- ReactionSeverity: MILD, MODERATE, SEVERE.
- NotificationType: GENERAL, REGISTRATION, CAMPAIGN, DONATION, CERTIFICATE, SYSTEM; mặc định GENERAL.
- NotificationChannel: IN_APP, EMAIL, SMS; mặc định IN_APP.
- NotificationStatus: PENDING, SENT, FAILED; mặc định PENDING.

CampaignStatus và DonationStatus tiếp tục dùng các giá trị trong schema; DonationStatus gồm PENDING, IN_PROGRESS, COMPLETED, STOPPED.

Enum không phải state machine; không dùng thứ tự enum để suy ra tiến độ.

## Field mới

| Entity            | Field                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| DonorProfile      | citizenId String? unique, gender Gender?, address String?                                                      |
| DonationCampaign  | description String?, registrationOpensAt/registrationClosesAt DateTime?, targetDonors/targetBloodVolumeMl Int? |
| HealthDeclaration | answers Json? (JSONB)                                                                                          |
| CheckIn           | checkedInById UUID?, checkedInBy User?                                                                         |
| Screening         | screenedById UUID?, screenedBy User?, decisionReason String?, deferredUntil DateTime? kiểu DATE                |
| ScreeningTest     | unit, referenceRange, notes: String?                                                                           |
| Donation          | performedById UUID?, performedBy User?, startedAt/completedAt DateTime?                                        |
| BloodBag          | status BloodBagStatus                                                                                          |
| Certificate       | status CertificateStatus, revokedAt DateTime?, revokeReason String?                                            |
| User              | performedCheckIns, performedScreenings, performedDonations (relation fields, không phải cột SQL)               |

Các timestamp mới dùng TIMESTAMPTZ(3); deferredUntil chỉ là ngày theo lịch nghiệp vụ, không phải thời điểm UTC.
Các field người thực hiện nullable trong schema. Nullable không đồng nghĩa được phép bỏ người thực hiện trong workflow mới: service tương lai lấy actor từ phiên đăng nhập đã xác thực.

Các trường liên quan đến phần mở rộng mới nhất (submittedAt/notes của HealthDeclaration và notes của Screening đã có từ migration đầu):

| Entity               | Bổ sung hoặc thay đổi                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| User                 | emailVerifiedAt, lastLoginAt: DateTime?                                                                                               |
| Role, Permission     | description: String?                                                                                                                  |
| DonorProfile         | bloodType: BloodType?; emergencyName, emergencyPhone: String?                                                                         |
| DonationCampaign     | organizerName, contactPhone: String?                                                                                                  |
| CampaignTimeSlot     | label: String?; isActive: Boolean, mặc định true                                                                                      |
| CampaignStaff        | assignment: CampaignAssignment?                                                                                                       |
| Registration         | cancelReason, notes: String?                                                                                                          |
| HealthDeclaration    | submittedAt: DateTime?; questionnaireVersion, notes: String?                                                                          |
| CheckIn              | notes: String?                                                                                                                        |
| Screening            | notes: String?; weightKg: Decimal(5,2)?; systolicBp, diastolicBp, pulse: Int?; temperatureC: Decimal(4,2)?; hemoglobin: Decimal(5,2)? |
| ScreeningTest        | numericValue: Decimal(12,4)?; isPassed: Boolean?                                                                                      |
| Donation             | donationType: DonationType, mặc định WHOLE_BLOOD; notes: String?                                                                      |
| BloodBag             | bloodType: BloodType?; component: BloodComponent, mặc định WHOLE_BLOOD; collectedAt, expiresAt: DateTime?; storageLocation: String?   |
| PostDonationReaction | severity: ReactionSeverity?; actionTaken: String?; resolvedAt: DateTime?                                                              |
| Certificate          | fileUrl: String?                                                                                                                      |
| Notification         | type, channel, status theo enum và default ở trên; sentAt: DateTime?                                                                  |
| AuditLog             | metadata: Json?; ipAddress, userAgent: String?; bỏ updatedAt                                                                          |
| SystemSetting        | valueType, category: String?                                                                                                          |

## Người thực hiện và bảo toàn lịch sử

Named relations: CheckInPerformedBy, ScreeningPerformedBy, DonationPerformedBy.
Mỗi FK trỏ User.id và dùng onDelete Restrict. Dùng isActive để ngừng tài khoản có lịch sử; không xóa người thực hiện để làm mất dấu vết.
Screening.screenedBy đại diện người chịu trách nhiệm đánh giá/kết luận hiện tại; chưa mô hình hóa nhiều người cùng sàng lọc.

Certificate REVOKED vẫn giữ donationId và code duy nhất. Khi triển khai service thu hồi, ghi status/revokedAt/revokeReason cùng transaction; không hard-delete.
AuditLog được thiết kế theo hướng append-only; schema hiện chỉ có createdAt, không còn updatedAt. metadata lưu thông tin bổ sung, ipAddress/userAgent lưu ngữ cảnh thao tác. Service ghi log chưa được triển khai; việc bỏ updatedAt không tự ngăn UPDATE/DELETE bằng Prisma hoặc SQL. actorId dùng onDelete SetNull để giữ log khi tài khoản được xóa.

## Thời gian và thể tích Donation

- startedAt: bắt đầu lấy máu.
- completedAt: kết thúc quá trình lấy máu, kể cả trường hợp dừng giữa chừng.
- donatedAt: thời điểm nhân viên xác nhận lượt hiến hoàn thành thành công; không tự sao chép completedAt.
- Dữ liệu cũ có donatedAt nhưng chưa biết thời gian lấy máu được giữ nguyên; không tự suy đoán để backfill.
- Khi ghi đủ thời gian mới, kiểm tra startedAt <= completedAt <= donatedAt (nếu có xác nhận).
- Donation.volumeMl là tổng thể tích đã lấy của lượt hiến.
- BloodBag.volumeMl là thể tích riêng của từng túi. Giữ quan hệ 1:N.
- Khi hoàn tất ghi nhận túi, service tương lai phải đối soát tổng các túi với Donation.volumeMl trong transaction. Schema không tự đồng bộ hai giá trị.
- validateDonation kiểm tra thời gian/số dương cho bản ghi mới; cần hợp nhất dữ liệu hiện tại trước khi validate một partial update.

## Kết quả sàng lọc và khai báo sức khỏe

Screening lưu trực tiếp các chỉ số weightKg, systolicBp, diastolicBp, pulse, temperatureC và hemoglobin tại lượt khám. ScreeningTest lưu các kết quả xét nghiệm theo code, hỗ trợ result dạng chuỗi, numericValue dạng số và isPassed tùy chọn. Schema chưa có cơ chế ngăn cùng một chỉ số được lưu ở cả hai nơi; khi triển khai cần chốt nguồn dữ liệu chính cho từng chỉ số để tránh lệch kết quả.
Chọn một kết quả hiện hành cho mỗi code trong một Screening, ràng buộc unique(screeningId, code). Nếu cần lưu nhiều lần đo, phải bổ sung mô hình lần đo bằng migration sau; không lặng lẽ ghi đè lịch sử cần lưu.
result giữ String? để tương thích; unit/referenceRange là metadata. referenceRange chỉ để hiển thị, không tự suy ra đủ điều kiện từ chuỗi này.
assertMeasurement cung cấp kiểm tra số dương/giới hạn hữu hạn và tùy chọn số nguyên. Giới hạn nhiệt độ/mạch phải lấy từ chính sách đã duyệt hoặc SystemSetting; chưa seed ngưỡng y tế tùy ý.
Hiện chưa có danh mục test bắt buộc hoặc quy tắc đồng bộ giữa Screening và ScreeningTest; helper kiểm tra số chưa thay thế validation đầy đủ cho các trường mới.

answers là snapshot câu trả lời của riêng HealthDeclaration, ví dụ:

```json
{ "hasChronicDisease": false, "currentMedications": [], "recentIllness": false }
```

Không lưu lịch sử người hiến ở đây. Khi cần biểu mẫu động, thêm HealthQuestion/HealthAnswer và chuyển dữ liệu theo registrationId, giữ snapshot cũ để đối chiếu. Chưa khóa cấu trúc câu hỏi vì chưa chốt biểu mẫu.

## Index và constraint

Giữ mọi index/unique cũ, gồm CampaignTimeSlot(id, campaignId) và FK Registration(timeSlotId, campaignId).

Thêm:

- DonorProfile.citizenId unique; nhiều NULL được phép. Application cần trim và chuyển thông tin chưa có sang null, không dùng chuỗi rỗng.
- ScreeningTest(screeningId, code) unique.
- DonationCampaign(status, startsAt): danh sách đợt theo trạng thái/thời gian.
- Registration(campaignId, status): danh sách đăng ký của đợt.
- Screening.status, Donation.status, BloodBag.status: hàng đợi xử lý.
- CheckIn.checkedInById, Screening.screenedById, Donation.performedById: tra cứu theo nhân viên và kiểm tra FK.
- Migration mở rộng bổ sung index DonorProfile.bloodType, Donation.donationType, BloodBag.bloodType, BloodBag(status, expiresAt), PostDonationReaction.severity, Notification(status, createdAt) và AuditLog.createdAt.

Không thêm Registration(donorId) riêng vì unique(donorId, campaignId) đã có donorId đứng đầu.

## Application validation

Đã có:

- validateCampaign: startsAt < endsAt, thứ tự cửa sổ đăng ký, targetDonors/targetBloodVolumeMl >= 0.
- validateTimeSlot: startsAt < endsAt, nằm trong thời gian campaign, capacity nguyên dương.
- timeSlotService.create: đọc campaign và validate trước khi ghi.
- timeSlotService.schedule: campaign OPEN, trong cửa sổ đăng ký nếu được cấu hình, slot chưa bắt đầu, registration cùng campaign và chưa check-in; trạng thái được phép PENDING/WAITLISTED/SCHEDULED.
- Transaction Serializable + retry P2034 bảo vệ count/update trước tranh chấp chỗ. CANCELLED và WAITLISTED không chiếm chỗ; các trạng thái khác có timeSlotId vẫn chiếm chỗ. Khi xếp lại chính registration vào slot hiện có, không đếm nó hai lần.
- volumeSchema/validateDonation: volume nguyên dương nếu có.
- Workflow guards: check-in chỉ từ SCHEDULED/CONFIRMED, screening cần check-in, donation cần ELIGIBLE, certificate cần COMPLETED.

Service xếp lịch chỉ là nền tảng nội bộ, chưa có API đăng ký/CRUD. Các workflow guards và validation campaign/donation/measurement chưa được nối vào endpoint vì endpoint chưa tồn tại. Mọi đường ghi mới, gồm đổi capacity/trạng thái, phải gọi validation và phối hợp transaction; ghi thẳng Prisma/SQL có thể bỏ qua các business rule này. Actor authorization sẽ được áp dụng khi triển khai authentication.

## Migration và kiểm thử

Đối với migration refine cũ, `node apps/api/scripts/refine-preflight.mjs` kiểm tra test trùng trước khi thêm unique và in số bản ghi, không in dữ liệu cá nhân. Script này không kiểm tra đầy đủ phần mở rộng mới nhất.

Migration mở rộng chạy trong transaction. CampaignStaff.assignment được cast trực tiếp từ chuỗi sang enum để giữ giá trị cũ; nếu có giá trị ngoài CHECK_IN/SCREENING/COLLECTION/SUPPORT, migration sẽ thất bại và rollback, cần đối chiếu dữ liệu trước khi thử lại. AuditLog.updatedAt được lưu vào metadata.legacyUpdatedAt trước khi bỏ cột. Không xóa dữ liệu trùng tự động. `db:deploy` chỉ áp dụng migration đã có; `db:generate` chỉ sinh Prisma Client, không cập nhật cấu trúc database.

Các lệnh dưới đây phục vụ áp dụng và kiểm tra trên từng môi trường:

```sh
pnpm --filter @blood/api exec prisma format
pnpm --filter @blood/api exec prisma validate
pnpm db:deploy
pnpm db:generate
pnpm db:seed
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Tests dùng PostgreSQL thật; dữ liệu constraint tests được rollback. Test tranh chấp capacity dùng UUID riêng rồi chỉ xóa fixture của chính test.
Seed (Phase 1) dùng upsert cho role/permission và đồng bộ RolePermission theo đúng `ROLE_PERMISSIONS`; chạy hai lần vẫn giữ 5 role và không tạo mapping thừa. Tài khoản admin chỉ được tạo khi có `ADMIN_EMAIL`/`ADMIN_PASSWORD`, mật khẩu lưu dưới dạng hash scrypt.

## Phase 1 — chuẩn hoá RBAC và phiên đăng nhập

Migration `20260919000000_phase1_rbac_and_auth_sessions`:

- Gộp role cũ sang mô hình 5 role: `SCREENING_STAFF` + `DOCTOR` → `MEDICAL_STAFF`; `COORDINATOR` → `ADMIN`. Bản ghi `UserRole` được trỏ lại role mới (bỏ trùng), sau đó role cũ bị xoá; `RolePermission` của role cũ bị xoá theo cascade.
- Tạo `AuthSession` (phiên refresh token) và `PasswordResetToken`. Cả hai chỉ lưu hash token (`tokenHash` unique), có `expiresAt`; `AuthSession` thêm `revokedAt`/`replacedById` cho rotation và thu hồi khi logout.

Mã role trong DB là chuỗi (không phải enum), vì vậy migration chỉ cần chuyển dữ liệu và xoá role cũ; `Role.code` tiếp tục unique. Không còn enum/role trùng lặp trong source: 5 role được định nghĩa duy nhất tại `ROLE_CODES` trong `@blood/shared-types`.

## Chưa triển khai

Schema đã có ReactionSeverity, PostDonationReaction.actionTaken/resolvedAt và AuditLog.metadata/ipAddress/userAgent, nhưng chưa có API nghiệp vụ tương ứng. Chưa có recordedBy cho phản ứng, CheckInMethod, biểu mẫu động hoặc entity Location riêng. CampaignTimeSlot.isActive đã có trong schema nhưng service xếp lịch hiện chưa kiểm tra trường này.
Không thêm DonationHistory, inventory, bệnh viện, truyền máu hay microservice.
Không seed SystemSetting ngưỡng y tế khi chưa chốt chính sách.

Health/seed không sử dụng trực tiếp phần lớn trường mới, nhưng không thể dùng kết quả của chúng để kết luận schema và database đã đồng bộ. Cần kiểm tra migration, sinh lại Prisma Client và chạy các kiểm thử liên quan sau khi đồng bộ; các giá trị mặc định trên dữ liệu có sẵn cần được đối chiếu khi áp dụng.
