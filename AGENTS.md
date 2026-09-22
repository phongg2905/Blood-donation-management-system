# Quy tắc phối hợp trong dự án

Đây là dự án nhiều người cùng phát triển. Tôn trọng phạm vi công việc và phần bàn giao của từng thành viên.

## Tích hợp frontend với backend

- Khi nhận việc FE hoặc tích hợp FE–BE, sửa frontend theo API do BE cung cấp.
- Không tự sửa `apps/api/**`, schema/migration, seed, test BE, các kiểu hoặc validation dùng chung trong `packages/shared-*/**`, hay hợp đồng API trong `docs/api/**` để làm FE chạy.
- Nếu cần thay đổi API, báo rõ endpoint, dữ liệu hiện có, dữ liệu FE cần và ảnh hưởng. Chỉ thực hiện khi người dùng xác nhận đã thống nhất với bên phụ trách BE.
- Không tự thêm trường response, endpoint, mã lỗi, quyền hay quy tắc nghiệp vụ. Không dùng mock để giả định BE đã hỗ trợ.
- Giữ nguyên ghi chú chờ thống nhất và kế hoạch phase của BE. Không tự đánh dấu hoàn thành hoặc chuyển việc còn thiếu sang phase khác.
- Với API chưa trả về dữ liệu cần đọc lại, giới hạn giao diện theo khả năng hiện có và ghi phần còn thiếu trong tài liệu FE.

## Bảo toàn công việc và xác nhận kết quả

- Kiểm tra thay đổi đang có trước khi sửa. Chỉ hoàn tác đúng phần do mình tạo; không ghi đè công việc của thành viên khác.
- Không format hoặc dọn mã bên ngoài phạm vi được giao.
- Kiểm tra tên trường request/response, lỗi, cookie/token với API gốc. Phân biệt test mock, kiểm tra hợp đồng và thử tích hợp thật.
- Không tuyên bố toàn hệ thống hoặc một phase hoàn tất chỉ vì unit test và build đạt. Báo đúng phạm vi đã kiểm chứng và phần còn thiếu.
- Không tạo nhánh, stage, commit, push, pull, merge hoặc tạo/sửa PR nếu chưa được người dùng yêu cầu cho công việc hiện tại. Có thể đọc trạng thái và diff local để rà soát.
