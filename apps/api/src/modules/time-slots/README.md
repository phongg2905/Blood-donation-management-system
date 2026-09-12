# time-slots

Đã có time-slot.service.ts, time-slot.repository.ts và time-slot.validation.ts; chưa có endpoint nghiệp vụ.

Service create kiểm tra thời gian nằm trong campaign và capacity dương. Service schedule xếp một registration hiện có vào slot, kiểm tra trạng thái/thời gian đăng ký và sức chứa trong transaction Serializable, retry tối đa 2 lần khi có xung đột. Controller tương lai phải xác thực và phân quyền trước khi gọi service.

Khi triển khai: routes → controller → service → repository → Prisma.
Validation nằm trong *.validation.ts; controller chỉ điều phối HTTP.
Module khác sử dụng service công khai, không gọi trực tiếp repository của module này.
