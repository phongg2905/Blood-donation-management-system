# permissions

Danh mục permission Phase 1 nằm ở `PERMISSION_CODES` (`@blood/shared-types`), mã hoá theo `resource.action`; mapping theo role ở `ROLE_PERMISSIONS`.

Kiểm tra quyền ở tầng action, không hard-code role trong controller:

```ts
router.post(
  '/:id/open',
  requireAuth,
  requirePermission('campaign.open'),
  openCampaign,
);
```

`requirePermission` / `requireAnyPermission` ở `middlewares/permission.middleware.ts` đọc `req.auth.permissions` (do adapter xác thực điền vào). `requireRole` chỉ dùng cho rule thực sự theo role.

`pnpm db:seed` upsert toàn bộ permission và mapping; mapping thừa so với `ROLE_PERMISSIONS` sẽ bị xoá để seed luôn hội tụ về đúng ma trận. Endpoint `GET /permissions` là Phase 2 (`permission.read`).

Quy tắc phân tách trách nhiệm: mỗi quyền thay đổi nghiệp vụ chỉ gán cho **một** role nghiệp vụ (ngoài ADMIN) — reception sở hữu check-in/no-show, medical sở hữu screening, collection sở hữu donation/blood bag/reaction/certificate issue, donor sở hữu đăng ký và khai báo. `certificate.revoke` chỉ ADMIN; `notification.read` là quyền dùng chung của cả 5 role. Test `phase1.test.ts` kiểm tra bất biến này.
