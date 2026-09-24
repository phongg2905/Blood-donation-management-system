# API conventions (Phase 1)

Base URL: http://localhost:3000/api

Stack: Express 5, Prisma 6, Zod 4, TypeScript strict. Route → Controller → Service → Repository → Prisma.
Shared contracts live in `@blood/shared-types` and `@blood/shared-validation`; the API and web app import the same types.

## Success response

```json
{ "success": true, "data": {} }
```

## List response

`GET` list endpoints always return `data` as an array plus `meta`:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

Pagination input is `?page=&limit=`, clamped by `resolvePagination`
(default page 1, limit 10, max limit 100). Build responses with
`sendSuccess`, `sendCreated` and `sendList` from `common/helpers/response.ts`
so no controller invents its own shape.

## Error response

```json
{
  "success": false,
  "error": {
    "code": "TIME_SLOT_FULL",
    "message": "Khung giờ đã đủ số lượng đăng ký",
    "fields": null
  }
}
```

Validation error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "fields": { "email": "Email không hợp lệ" }
  }
}
```

- `code` is a stable constant from `ERROR_CODES` in `@blood/shared-types`. **The frontend branches on `code`.**
- `message` is a Vietnamese default from `ERROR_MESSAGES`; a call site may override it.
- `fields` is `null` unless the failure is field-scoped.
- Throw `AppError` only; `error.middleware.ts` is the single place that renders errors.
  Bad JSON → `REQUEST_INVALID` (400), oversized body → `PAYLOAD_TOO_LARGE` (413),
  unknown route → `ROUTE_NOT_FOUND` (404), unexpected → `INTERNAL_ERROR` (500) with no internal detail.

## Datetime convention

All timestamps are serialised as **ISO 8601 UTC** (`2026-09-19T01:30:00.000Z`).
One format only — the frontend formats for display. `deferredUntil` is a
business calendar date (`DATE`, no time component).

## Unit convention

| Quantity       | Field                             | Unit |
| -------------- | --------------------------------- | ---- |
| Volume         | `volumeMl`, `targetBloodVolumeMl` | ml   |
| Weight         | `weightKg`                        | kg   |
| Temperature    | `temperatureC`                    | °C   |
| Blood pressure | `systolicBp`, `diastolicBp`       | mmHg |
| Pulse          | `pulse`                           | bpm  |
| Hemoglobin     | `hemoglobin`                      | g/dL |

Exposed as `MEASUREMENT_UNITS`. Screening test codes must come from
`SCREENING_TEST_CATALOG`; arbitrary codes are rejected with
`SCREENING_TEST_CODE_INVALID`.

## Roles, permissions and authorization

Exactly four actor roles (`ROLE_CODES`): `DONOR`, `DONATION_STAFF`,
`COORDINATOR`, `SYSTEM_ADMIN`. The legacy five-role codes `RECEPTION_STAFF`,
`MEDICAL_STAFF`, `BLOOD_COLLECTION_STAFF` (→ merged into `DONATION_STAFF`) and
`ADMIN` (→ renamed `SYSTEM_ADMIN`) are gone from the seed/guard/test surface;
`COORDINATOR` is a new, standalone actor and is never merged into
`SYSTEM_ADMIN`.

### Permission ownership

Ownership follows the task-assignment plan and keeps duties separate: DONOR
registers/self-serves, DONATION_STAFF receives/screens/collects (the merge of
the former reception, medical and blood-collection staff), COORDINATOR runs
campaigns end-to-end (create/manage campaigns, schedules/quotas, staff
assignment, progress/reporting), SYSTEM_ADMIN administers the system itself
(accounts, roles/permissions, catalogues/configuration, audit log, system
reporting). `ROLE_PERMISSIONS` in `@blood/shared-types` is the single source
of truth; `pnpm db:seed` converges the database on it.

| Role             | Responsibility                                                                                              | Permissions |
| ---------------- | -------------------------------------------------------------------------------------------------------------| ----------- |
| `DONOR`          | Register/reschedule/cancel own registration, health declaration, read own donation, certificate, reactions  | 15          |
| `DONATION_STAFF` | Arrival check-in/no-show, screening measurements/tests/review, donation start/complete/stop, blood bags, post-donation reactions, certificate issue | 25 |
| `COORDINATOR`    | Create/manage campaigns, set up time slots/quotas, assign/remove campaign staff, track progress and report  | 19          |
| `SYSTEM_ADMIN`   | User accounts, roles/permissions, settings/catalogues, audit log, system reporting, certificate revoke       | 16          |

Separation rules that the backend enforces:

- DONATION_STAFF owns the whole donor-facing operational flow, but has no
  campaign/staff-assignment or system-administration permissions.
- COORDINATOR may read campaign/registration data for reporting but has no
  clinical permissions (`screening.*`, `donation.*`, `bloodbag.*`,
  `reaction.*`, `certificate.*`).
- `certificate.issue` belongs to DONATION_STAFF only; `certificate.revoke` is
  SYSTEM_ADMIN-only (an administrative oversight action, deliberately kept
  out of DONATION_STAFF and out of COORDINATOR).
- `campaign.create`/`campaign_staff.assign` etc. belong to COORDINATOR only —
  SYSTEM_ADMIN does **not** hold them, so COORDINATOR's job is never folded
  into SYSTEM_ADMIN.
- Every mutating permission has exactly one owner; only shared reads
  (`campaign.read`, `timeslot.read`) and `notification.read` are granted to
  several roles.

Authorization is **permission-based** at the action level:

```ts
router.post(
  '/:id/open',
  requireAuth,
  requirePermission('campaign.open'),
  openCampaign,
);
```

- `requirePermission(...codes)` / `requireAnyPermission(...codes)` → `permission.middleware.ts`
- `requireRole(...roles)` exists for genuinely role-shaped rules only.
- `req.auth = { userId, roles, permissions, sessionId? }`. An authentication
  adapter must populate it; never trust headers sent by the client.

## Validation

Validate at the edge (`validate(schema, 'body' | 'query' | 'params')`, parsed
value at `res.locals.validated`) **and** re-check business rules in the service,
because direct Prisma/SQL writes can bypass HTTP validation. Shared rules live in
the owning module's `*.validation.ts` and are reused by the service layer.

## State transitions

Transitions are centralized in `@blood/shared-types`
(`CAMPAIGN_TRANSITIONS`, `REGISTRATION_TRANSITIONS`, `SCREENING_TRANSITIONS`,
`DONATION_TRANSITIONS`, `BLOOD_BAG_TRANSITIONS`) and enforced on the backend via
`assertTransition` in `common/helpers/state-machine.ts`. The frontend reads the
same maps to decide which actions to render.

## Auth strategy (implemented in Phase 2)

- Short-lived **JWT access token** (default 15 minutes) in `Authorization: Bearer`.
- **Refresh token** in an HttpOnly, Secure, SameSite cookie (`bd_refresh_token`, 30 days).
- `POST /api/auth/refresh` rotates the session; `POST /api/auth/logout` revokes it.
- Only hashes are stored: `AuthSession.tokenHash`, `PasswordResetToken.tokenHash`;
  passwords use scrypt (`common/security/password.ts`). No plain-text secret column exists.
- `GET /api/auth/me` returns `{ id, email, fullName, roles, permissions }`, which the
  frontend uses for protected routes, sidebar/menu and action visibility.

## Endpoints available today

### GET /health

Runs `SELECT 1` through Prisma/PostgreSQL.

HTTP 200:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-09-19T01:30:00.000Z"
  }
}
```

HTTP 503 (`error.code = "DATABASE_UNAVAILABLE"`) when PostgreSQL is unreachable;
the failure envelope never leaks connection details.

### Demo accounts (dev/test only — `pnpm db:seed`)

One account per role for FE integration, seeded automatically unless
`NODE_ENV=production`. Password is the same for all of them:
`Demo@Password1`.

| Role             | Email                                                                |
| ---------------- | --------------------------------------------------------------------- |
| DONOR            | donor.demo@example.local                                            |
| DONATION_STAFF   | donation-staff.demo@example.local                                   |
| COORDINATOR      | coordinator.demo@example.local                                      |
| SYSTEM_ADMIN     | set via `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` — no fixed default |

Auth endpoints (`login`, `refresh`, `logout`, `me`) are implemented — see
[Frontend contract](frontend-contract.md) for the full Auth surface. Other
business endpoints are not implemented yet.
