# audit-logs

Nền tảng AuditLog đã có ở Phase 1.

- `audit-log.repository.ts`: ghi bản ghi append-only (`AuditLog` không có `updatedAt`).
- `audit.service.ts`: `record(input, client)` ghi trong cùng transaction nghiệp vụ;
  `recordSafely` cho trường hợp best-effort (ví dụ `LOGIN_FAILED` với email không tồn tại);
  `auditContextFrom(req)` lấy `actorId` từ `req.auth` cùng `ipAddress`/`userAgent`.

```ts
await auditLogService.record(
  {
    action: AUDIT_ACTIONS.REGISTRATION_CANCELLED,
    entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
    entityId: registration.id,
    metadata: { previousStatus },
    ...auditContextFrom(req),
  },
  tx,
);
```

Action và entity type dùng hằng số trong `@blood/shared-types` (`AUDIT_ACTIONS`, `AUDIT_ENTITY_TYPES`) — không hard-code chuỗi.

Phase 8 chỉ còn query/filter và admin UI; không cần đổi schema.
