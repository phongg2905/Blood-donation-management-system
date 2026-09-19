# Frontend contract (Phase 2 surface)

The frontend can build UI and mocks against this contract before the endpoints
exist. Every response uses the envelopes in [API conventions](README.md), and
every `error.code` comes from `ERROR_CODES` in `@blood/shared-types`, so the FE
can branch on codes without parsing messages.

Column notes: `perm` = permission required by `requirePermission`; list
endpoints accept `?page=&limit=` and return `meta`; all timestamps are ISO 8601
UTC.

## Which role owns which endpoint group

| Role                     | Endpoint groups it can call                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DONOR`                  | `GET /auth/me`, `GET/PATCH /auth/me`, own campaign/timeslot read, own registration create/reschedule/cancel, own declaration, own history/certificate/reactions read                            |
| `RECEPTION_STAFF`        | donor lookup (`GET /users`), `GET /registrations`, `POST /registrations/:id/check-in`, `POST /registrations/:id/no-show`, declaration read                                                      |
| `MEDICAL_STAFF`          | `GET /screenings/:id`, `POST /registrations/:id/screening`, `PATCH /screenings/:id`, `POST /screenings/:id/review`, read-only donation/reaction/certificate                                     |
| `BLOOD_COLLECTION_STAFF` | `POST /screenings/:id/donation`, `POST /donations/:id/complete`, `POST /donations/:id/stop`, blood-bag CRUD, `POST /donations/:id/reactions`, `POST /donations/:id/certificate`, screening read |
| `ADMIN`                  | everything above plus campaign/timeslot/campaign-staff/user/role/permission/notification/audit/setting/report and certificate revoke                                                            |

Hidden actions for the FE (do not render the button when the permission is
absent from `CurrentUser.permissions`):

- MEDICAL_STAFF: no "Bắt đầu hiến máu", "Hoàn tất", "Dừng", "Tạo túi máu", "Cấp chứng nhận", "Thu hồi chứng nhận".
- BLOOD_COLLECTION_STAFF: no "Kết luận sàng lọc".
- RECEPTION_STAFF: no screening, donation, blood-bag, reaction or certificate actions.

## Auth

| Method | Path            | Params / Query | Request DTO                       | Response DTO                                          | perm                  | Error codes                           |
| ------ | --------------- | -------------- | --------------------------------- | ----------------------------------------------------- | --------------------- | ------------------------------------- |
| POST   | `/auth/login`   | —              | `{ email, password }`             | `{ accessToken, user: CurrentUser }` + refresh cookie | public                | `VALIDATION_ERROR`, `UNAUTHENTICATED` |
| POST   | `/auth/refresh` | —              | refresh cookie                    | `{ accessToken }`                                     | refresh cookie        | `UNAUTHENTICATED`                     |
| POST   | `/auth/logout`  | —              | refresh cookie                    | `{}`                                                  | refresh cookie        | `UNAUTHENTICATED`                     |
| GET    | `/auth/me`      | —              | —                                 | `CurrentUser`                                         | `auth.profile.read`   | `UNAUTHENTICATED`                     |
| PATCH  | `/auth/me`      | —              | `{ fullName?, phone?, address? }` | `CurrentUser`                                         | `auth.profile.update` | `VALIDATION_ERROR`, `UNAUTHENTICATED` |

`CurrentUser = { id, email, fullName, roles: RoleCode[], permissions: PermissionCode[] }`.

## Campaigns

| Method | Path                    | Params / Query                    | Request DTO      | Response DTO        | perm              | Error codes                                                            |
| ------ | ----------------------- | --------------------------------- | ---------------- | ------------------- | ----------------- | ---------------------------------------------------------------------- |
| GET    | `/campaigns`            | `?status=&from=&to=&page=&limit=` | —                | `Campaign[]` + meta | `campaign.read`   | —                                                                      |
| GET    | `/campaigns/:id`        | `id`                              | —                | `Campaign`          | `campaign.read`   | `CAMPAIGN_NOT_FOUND`                                                   |
| POST   | `/campaigns`            | —                                 | `CreateCampaign` | `Campaign`          | `campaign.create` | `VALIDATION_ERROR`, `CAMPAIGN_DATE_INVALID`, `CAMPAIGN_TARGET_INVALID` |
| PATCH  | `/campaigns/:id`        | `id`                              | `UpdateCampaign` | `Campaign`          | `campaign.update` | `CAMPAIGN_NOT_FOUND`, `CAMPAIGN_NOT_EDITABLE`, `CAMPAIGN_DATE_INVALID` |
| POST   | `/campaigns/:id/open`   | `id`                              | —                | `Campaign`          | `campaign.open`   | `CAMPAIGN_INVALID_TRANSITION`                                          |
| POST   | `/campaigns/:id/close`  | `id`                              | —                | `Campaign`          | `campaign.close`  | `CAMPAIGN_INVALID_TRANSITION`                                          |
| POST   | `/campaigns/:id/cancel` | `id`                              | `{ reason? }`    | `Campaign`          | `campaign.cancel` | `CAMPAIGN_INVALID_TRANSITION`                                          |

```
CreateCampaign {
  name, location, description?, organizerName?, contactPhone?,
  startsAt, endsAt,
  registrationOpensAt?, registrationClosesAt?,
  targetDonors?, targetBloodVolumeMl?
}
```

Rules enforced server-side: `startsAt < endsAt`, `registrationOpensAt <
registrationClosesAt`, `registrationClosesAt <= startsAt`, targets `> 0` when
present; only `OPEN` accepts registrations; `COMPLETED` is frozen.

## Time slots

| Method | Path                         | Params / Query | Request DTO                                 | Response DTO | perm                  | Error codes                                         |
| ------ | ---------------------------- | -------------- | ------------------------------------------- | ------------ | --------------------- | --------------------------------------------------- |
| GET    | `/campaigns/:id/time-slots`  | `?activeOnly=` | —                                           | `TimeSlot[]` | `timeslot.read`       | `CAMPAIGN_NOT_FOUND`                                |
| POST   | `/campaigns/:id/time-slots`  | `id`           | `{ startsAt, endsAt, capacity, label? }`    | `TimeSlot`   | `timeslot.create`     | `TIME_SLOT_OUTSIDE_CAMPAIGN`, `VALIDATION_ERROR`    |
| PATCH  | `/time-slots/:id`            | `id`           | `{ startsAt?, endsAt?, capacity?, label? }` | `TimeSlot`   | `timeslot.update`     | `TIME_SLOT_NOT_FOUND`, `TIME_SLOT_OUTSIDE_CAMPAIGN` |
| POST   | `/time-slots/:id/deactivate` | `id`           | —                                           | `TimeSlot`   | `timeslot.deactivate` | `TIME_SLOT_NOT_FOUND`                               |

A deactivated slot (`isActive: false`) can never be scheduled or rescheduled —
`TIME_SLOT_INACTIVE`.

## Registrations

| Method | Path                            | Params / Query                      | Request DTO                   | Response DTO            | perm                        | Error codes                                                                                                                                                        |
| ------ | ------------------------------- | ----------------------------------- | ----------------------------- | ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/registrations`                | `?campaignId=&status=&page=&limit=` | —                             | `Registration[]` + meta | `registration.read`         | —                                                                                                                                                                  |
| GET    | `/registrations/:id`            | `id`                                | —                             | `Registration`          | `registration.read`         | `REGISTRATION_NOT_FOUND`                                                                                                                                           |
| POST   | `/registrations`                | —                                   | `{ campaignId, timeSlotId? }` | `Registration`          | `registration.create`       | `CAMPAIGN_NOT_OPEN`, `REGISTRATION_CLOSED`, `REGISTRATION_WINDOW_CLOSED`, `REGISTRATION_DUPLICATE`, `TIME_SLOT_FULL`, `TIME_SLOT_INACTIVE`, `REGISTRATION_OVERLAP` |
| POST   | `/registrations/:id/reschedule` | `id`                                | `{ timeSlotId }`              | `Registration`          | `registration.reschedule`   | `REGISTRATION_OVERLAP`, `TIME_SLOT_FULL`, `TIME_SLOT_INACTIVE`, `REGISTRATION_INVALID_TRANSITION`                                                                  |
| POST   | `/registrations/:id/cancel`     | `id`                                | `{ reason? }`                 | `Registration`          | `registration.cancel`       | `REGISTRATION_INVALID_TRANSITION`                                                                                                                                  |
| POST   | `/registrations/:id/check-in`   | `id`                                | `{ notes? }`                  | `CheckIn`               | `registration.checkin`      | `CHECK_IN_NOT_ALLOWED`, `REGISTRATION_ALREADY_CHECKED_IN`                                                                                                          |
| POST   | `/registrations/:id/no-show`    | `id`                                | `{ reason? }`                 | `Registration`          | `registration.mark_no_show` | `REGISTRATION_INVALID_TRANSITION`                                                                                                                                  |

Waitlist: when the chosen slot is full and a waitlist is offered, the
registration is created as `WAITLISTED` and promoted later via
`/registrations/:id/reschedule`. A donor has one registration per campaign; a
`CANCELLED` registration is reused when the donor registers again.

## Health declaration

| Method | Path                             | Request DTO                                          | perm                                                      | Error codes              |
| ------ | -------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- | ------------------------ |
| GET    | `/registrations/:id/declaration` | —                                                    | `health_declaration.read`                                 | `REGISTRATION_NOT_FOUND` |
| PUT    | `/registrations/:id/declaration` | `{ answers: object, questionnaireVersion?, notes? }` | `health_declaration.create` / `health_declaration.update` | `VALIDATION_ERROR`       |

## Screening

| Method | Path                           | Request DTO                                           | perm               | Error codes                                                            |
| ------ | ------------------------------ | ----------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| GET    | `/screenings/:id`              | —                                                     | `screening.read`   | `SCREENING_NOT_FOUND`                                                  |
| POST   | `/registrations/:id/screening` | `ScreeningCreate`                                     | `screening.create` | `CHECK_IN_REQUIRED`, `VALIDATION_ERROR`, `SCREENING_TEST_CODE_INVALID` |
| PATCH  | `/screenings/:id`              | `ScreeningUpdate`                                     | `screening.update` | `SCREENING_INVALID_TRANSITION`, `MEASUREMENT_INVALID`                  |
| POST   | `/screenings/:id/review`       | `{ status, decisionReason?, deferredUntil?, notes? }` | `screening.review` | `SCREENING_REVIEW_REASON_REQUIRED`, `SCREENING_INVALID_TRANSITION`     |

```
ScreeningCreate {
  weightKg, temperatureC, systolicBp, diastolicBp, pulse, hemoglobin,
  tests: [{ code, result?, numericValue?, unit?, referenceRange?, isPassed?, notes? }]
}
```

`status` must be one of `WAITING_REVIEW | ELIGIBLE | INELIGIBLE | DEFERRED`.
`DEFERRED` requires `decisionReason`. `tests[].code` must come from
`SCREENING_TEST_CATALOG`.

## Donation

| Method | Path                       | Request DTO                                                | perm                | Error codes                                                                  |
| ------ | -------------------------- | ---------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| GET    | `/donations`               | —                                                          | `donation.read`     | —                                                                            |
| POST   | `/screenings/:id/donation` | `{ donationType? }`                                        | `donation.start`    | `SCREENING_NOT_ELIGIBLE`, `CHECK_IN_REQUIRED`, `DONATION_INVALID_TRANSITION` |
| POST   | `/donations/:id/complete`  | `{ startedAt, completedAt, donatedAt?, volumeMl, notes? }` | `donation.complete` | `DONATION_VOLUME_INVALID`, `DONATION_TIME_INVALID`, `VALIDATION_ERROR`       |
| POST   | `/donations/:id/stop`      | `{ reason?, notes? }`                                      | `donation.stop`     | `DONATION_INVALID_TRANSITION`                                                |

`COMPLETED` requires `startedAt`, `completedAt`, `volumeMl > 0` and
`performedById`. `STOPPED` never yields a certificate.

## Blood bags

| Method | Path                        | Request DTO                                                                              | perm                     | Error codes                                                 |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| GET    | `/blood-bags`               | —                                                                                        | `bloodbag.read`          | —                                                           |
| POST   | `/donations/:id/blood-bags` | `{ code, volumeMl, bloodType?, component?, collectedAt?, expiresAt?, storageLocation? }` | `bloodbag.create`        | `DONATION_RECONCILIATION_FAILED`, `DONATION_VOLUME_INVALID` |
| PATCH  | `/blood-bags/:id/status`    | `{ status }`                                                                             | `bloodbag.update_status` | `BLOOD_BAG_INVALID_TRANSITION`                              |

Transition: `CREATED → COLLECTED → PENDING_TEST → TESTED → ACCEPTED | REJECTED`,
`REJECTED → DISCARDED`. The sum of bag `volumeMl` must equal
`Donation.volumeMl`.

## Reactions, certificates, notifications

| Method | Path                         | Request DTO                                             | perm                 | Error codes                                         |
| ------ | ---------------------------- | ------------------------------------------------------- | -------------------- | --------------------------------------------------- |
| GET    | `/donations/:id/reactions`   | —                                                       | `reaction.read`      | `DONATION_NOT_FOUND`                                |
| POST   | `/donations/:id/reactions`   | `{ description, severity?, actionTaken?, occurredAt? }` | `reaction.create`    | `VALIDATION_ERROR`                                  |
| GET    | `/certificates`              | —                                                       | `certificate.read`   | —                                                   |
| POST   | `/donations/:id/certificate` | `{ fileUrl? }`                                          | `certificate.issue`  | `DONATION_NOT_COMPLETED`, `CERTIFICATE_NOT_ALLOWED` |
| POST   | `/certificates/:id/revoke`   | `{ reason }`                                            | `certificate.revoke` | `CERTIFICATE_ALREADY_REVOKED`                       |
| GET    | `/notifications`             | `?unreadOnly=&page=&limit=`                             | `notification.read`  | —                                                   |
| POST   | `/notifications/read`        | `{ ids: string[] }`                                     | `notification.read`  | `VALIDATION_ERROR`                                  |

## Administration

| Method | Path                        | perm              | Notes                                                                  |
| ------ | --------------------------- | ----------------- | ---------------------------------------------------------------------- |
| GET    | `/users`                    | `user.read`       | `?q=&role=&isActive=&page=&limit=`                                     |
| PATCH  | `/users/:id`                | `user.manage`     | `{ fullName?, isActive? }` → `USER_UPDATED` / `USER_DEACTIVATED` audit |
| POST   | `/users/:id/roles`          | `role.manage`     | `{ roleCodes: RoleCode[] }` → `ROLE_ASSIGNED` / `ROLE_REMOVED` audit   |
| GET    | `/roles`                    | `role.read`       | 5 roles with their permissions                                         |
| GET    | `/permissions`              | `permission.read` | `PERMISSION_CODES` catalogue                                           |
| GET    | `/audit-logs`               | `audit.read`      | `?actorId=&action=&entityType=&entityId=&from=&to=&page=&limit=`       |
| GET    | `/settings`                 | `setting.read`    | `SystemSetting` list                                                   |
| PUT    | `/settings/:key`            | `setting.manage`  | `{ value, valueType?, category?, description? }`                       |
| GET    | `/reports/donations`        | `report.read`     | `?campaignId=&from=&to=`                                               |
| GET    | `/reports/donations/export` | `report.export`   | CSV/Excel download                                                     |

## Error handler checklist for the FE

| HTTP | Typical codes                                                                                                                                                                                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`, `REQUEST_INVALID`, `CAMPAIGN_DATE_INVALID`, `CAMPAIGN_TARGET_INVALID`, `MEASUREMENT_INVALID`, `SCREENING_REVIEW_REASON_REQUIRED`, `SCREENING_TEST_CODE_INVALID`, `DONATION_VOLUME_INVALID`, `DONATION_RECONCILIATION_FAILED`, `PAYLOAD_TOO_LARGE`                                                                                                 |
| 401  | `UNAUTHENTICATED`                                                                                                                                                                                                                                                                                                                                                     |
| 403  | `FORBIDDEN`                                                                                                                                                                                                                                                                                                                                                           |
| 404  | `ROUTE_NOT_FOUND`, `*_NOT_FOUND`                                                                                                                                                                                                                                                                                                                                      |
| 409  | transition/conflict codes: `CAMPAIGN_NOT_OPEN`, `CAMPAIGN_NOT_EDITABLE`, `REGISTRATION_DUPLICATE`, `REGISTRATION_OVERLAP`, `REGISTRATION_WINDOW_CLOSED`, `TIME_SLOT_FULL`, `TIME_SLOT_INACTIVE`, `CHECK_IN_NOT_ALLOWED`, `REGISTRATION_ALREADY_CHECKED_IN`, `SCREENING_NOT_ELIGIBLE`, `DONATION_NOT_COMPLETED`, `CERTIFICATE_ALREADY_REVOKED`, `*_INVALID_TRANSITION` |
| 503  | `DATABASE_UNAVAILABLE`                                                                                                                                                                                                                                                                                                                                                |
