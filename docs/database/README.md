# Database ban đầu

23 model trong `apps/api/prisma/schema.prisma`; UUID và timestamp UTC cho từng model.

- User ↔ Role ↔ Permission qua UserRole và RolePermission; các cặp là duy nhất. Hệ thống chỉ dùng 4 role (actor): DONOR, DONATION_STAFF, COORDINATOR, SYSTEM_ADMIN.
- AuthSession là phiên refresh token (chỉ lưu `tokenHash`); PasswordResetToken lưu hash token đặt lại mật khẩu. Không có cột lưu token/mật khẩu dạng plain text.
- User 1–0..1 DonorProfile; DonorProfile 1–n Registration.
- Một Registration duy nhất cho mỗi người hiến/đợt. Đăng ký lại sau hủy sẽ tái sử dụng bản ghi; nếu yêu cầu nghiệp vụ thay đổi phải điều chỉnh constraint.
- CampaignTimeSlot thuộc DonationCampaign. Foreign key ghép (timeSlotId, campaignId) ngăn chọn khung giờ của đợt khác.
- Registration → CheckIn → Screening → Donation → Certificate là chuỗi 1–0..1 tại mỗi bước.
- Screening có nhiều ScreeningTest; Donation có nhiều BloodBag và PostDonationReaction.
- Certificate thuộc lượt Donation, không thuộc từng túi máu.
- Lịch sử truy vấn qua DonorProfile → Registration → CheckIn → Screening → Donation; không lưu JSON lịch sử.
- CampaignStaff là phân công theo đợt; quyền hệ thống nằm ở RBAC.
- Bản ghi nghiệp vụ dùng onDelete Restrict để tránh xóa dây chuyền lịch sử. Bảng nối RBAC dùng Cascade.
- AuditLog giữ action/entity và cho phép actor null khi xóa tài khoản.
- SystemSetting lưu value dạng chuỗi; chưa có cấu hình nghiệp vụ/secret.

Đã refine schema và bổ sung service nội bộ kiểm tra khung giờ/sức chứa bằng transaction Serializable. Các validation khác đã chuẩn bị để tích hợp khi triển khai workflow; chưa có endpoint CRUD nghiệp vụ.
HealthDeclaration có answers JSONB để lưu nội dung khai báo theo lượt đăng ký; chưa có bộ câu hỏi động.

Chi tiết field, semantics, index và giới hạn: [Refinement](refinement.md).

Migration đầu tiên được commit. Dùng `pnpm db:migrate` khi phát triển và `pnpm db:deploy` để áp dụng migration có sẵn không tương tác.
Seed tùy chọn `pnpm db:seed` tạo 5 role, toàn bộ permission, mapping role-permission (đồng bộ đúng theo `ROLE_PERMISSIONS`) và tài khoản admin đầu tiên nếu có `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Chạy lặp an toàn; mật khẩu chỉ được lưu dưới dạng hash scrypt.
Migration `20260919000000_phase1_rbac_and_auth_sessions` gộp role cũ sang mô hình 5 role và tạo hai bảng phiên/token ở trên.
