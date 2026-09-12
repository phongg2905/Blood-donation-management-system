# Refine blood donation domain

Giữ 21 entity và toàn bộ quan hệ/RBAC cũ. Migration mới: `20260912070000_refine_blood_donation_domain`. Không reset, không xóa migration cũ.

## Enum

- Gender: MALE, FEMALE, OTHER.
- RegistrationStatus: thêm SCHEDULED (đã xếp lịch), WAITLISTED (chờ chỗ), NO_SHOW (không đến); giữ các giá trị cũ.
- ScreeningStatus: thêm WAITING_REVIEW (chờ kết luận), DEFERRED (tạm hoãn).
- BloodBagStatus: CREATED, COLLECTED, PENDING_TEST, TESTED, ACCEPTED, REJECTED, DISCARDED; mặc định CREATED.
- CertificateStatus: ACTIVE, REVOKED; mặc định ACTIVE.

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
Các field metadata mới nullable để giữ tương thích bản ghi cũ. Nullable không đồng nghĩa được phép bỏ người thực hiện trong workflow mới: service tương lai lấy actor từ phiên đăng nhập đã xác thực.

## Người thực hiện và bảo toàn lịch sử

Named relations: CheckInPerformedBy, ScreeningPerformedBy, DonationPerformedBy.
Mỗi FK trỏ User.id và dùng onDelete Restrict. Dùng isActive để ngừng tài khoản có lịch sử; không xóa người thực hiện để làm mất dấu vết.
Screening.screenedBy đại diện người chịu trách nhiệm đánh giá/kết luận hiện tại; chưa mô hình hóa nhiều người cùng sàng lọc.

Certificate REVOKED vẫn giữ donationId và code duy nhất. Khi triển khai service thu hồi, ghi status/revokedAt/revokeReason cùng transaction; không hard-delete.
AuditLog là append-only ở tầng business: không cung cấp update/delete service. Schema vẫn giữ updatedAt cũ; đây chưa phải cơ chế chống sửa bằng quyền SQL hoặc trigger.

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

Các chỉ số nằm ở ScreeningTest, không thêm cột weight/temperature/pulse trùng trên Screening.
Chọn một kết quả hiện hành cho mỗi code trong một Screening, ràng buộc unique(screeningId, code). Nếu cần lưu nhiều lần đo, phải bổ sung mô hình lần đo bằng migration sau; không lặng lẽ ghi đè lịch sử cần lưu.
result giữ String? để tương thích; unit/referenceRange là metadata. referenceRange chỉ để hiển thị, không tự suy ra đủ điều kiện từ chuỗi này.
assertMeasurement cung cấp kiểm tra số dương/giới hạn hữu hạn và tùy chọn số nguyên. Giới hạn nhiệt độ/mạch phải lấy từ chính sách đã duyệt hoặc SystemSetting; chưa seed ngưỡng y tế tùy ý.
WEIGHT_KG, TEMPERATURE, PULSE có thể chuẩn hóa thành code ở giai đoạn thiết kế bộ chỉ số; hiện chưa có danh mục test bắt buộc.

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

Trước khi thêm unique, `node apps/api/scripts/refine-preflight.mjs` kiểm tra test trùng và in số bản ghi, không in dữ liệu cá nhân.
Prisma migrate dev --create-only gặp môi trường không tương tác khi cần xác nhận unique, nên migration được sinh bằng Prisma migrate diff, rà soát SQL rồi áp dụng qua db:deploy.
Không xóa dữ liệu trùng tự động.

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
Seed role vẫn dùng upsert, không cần sửa; chạy hai lần vẫn giữ 7 role.

## Chưa triển khai

ReactionSeverity/treatment/recordedBy, CheckInMethod, audit metadata, biểu mẫu động và Location riêng được để lại theo ưu tiên 3.
Không thêm DonationHistory, inventory, bệnh viện, truyền máu hay microservice.
Không seed SystemSetting ngưỡng y tế khi chưa chốt chính sách.

Không có breaking change đối với backend health/seed hiện tại. Hai unique mới sẽ từ chối các bản ghi trùng trước đây có thể được phép; các actor FK mới bảo vệ việc xóa User. Field trạng thái mới có default; giá trị CREATED/ACTIVE trên dữ liệu có sẵn cần được đối chiếu khi áp dụng lên database đã có dữ liệu thực.
