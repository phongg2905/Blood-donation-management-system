# API conventions

Base URL: http://localhost:3000/api

## GET /health

Thực hiện SELECT 1 qua Prisma/PostgreSQL.

HTTP 200:

```json
{
  "success": true,
  "message": "Blood Donation API is running",
  "database": "connected",
  "data": { "database": "connected" }
}
```

HTTP 503 khi không kết nối được:

```json
{
  "success": false,
  "message": "Database is unavailable",
  "database": "disconnected",
  "errors": [{ "message": "PostgreSQL connection failed" }]
}
```

Success thông thường: `{ success: true, message, data }`.
Error: `{ success: false, message, errors: [{ path?, message }] }`.
Trường database ở top-level chỉ dành cho health để phù hợp contract ban đầu.

Route chưa có trả 404; JSON không hợp lệ trả 400; lỗi ngoài dự kiến trả 500 với thông báo chung.
Express 5 chuyển rejected promise từ async handler vào global error middleware:
[Express error handling](https://expressjs.com/en/5x/guide/error-handling/).

Validation: `validate(schema, 'body' | 'query' | 'params')`, kết quả đã parse ở `res.locals.validated`.
Shared schema mẫu: `idParamsSchema` từ `@blood/shared-validation`.

RBAC middleware là nền tảng: requireAuth/requireRole mặc định từ chối khi chưa có req.auth.
Chưa có adapter xác thực. Không đọc role hoặc user ID trực tiếp từ header do client tự gửi.
