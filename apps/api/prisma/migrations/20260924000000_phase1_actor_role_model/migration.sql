-- Phase 1: migrate RBAC from the five legacy roles to the four-actor model
-- from the task-assignment plan.
--   RECEPTION_STAFF + MEDICAL_STAFF + BLOOD_COLLECTION_STAFF -> DONATION_STAFF
--   ADMIN                                                    -> SYSTEM_ADMIN
--   (new) COORDINATOR
-- RolePermission rows are left for the next `pnpm db:seed` run to converge on
-- ROLE_PERMISSIONS from @blood/shared-types (same pattern as the previous
-- RBAC migration). Prisma wraps this in a transaction already.

-- ---------------------------------------------------------------------------
-- 1. Rename ADMIN -> SYSTEM_ADMIN in place (keeps id, UserRole, audit trail).
-- ---------------------------------------------------------------------------

UPDATE "Role" SET "code" = 'SYSTEM_ADMIN', "name" = 'Quản trị viên'
WHERE "code" = 'ADMIN';

-- ---------------------------------------------------------------------------
-- 2. Rename RECEPTION_STAFF -> DONATION_STAFF in place, then fold
--    MEDICAL_STAFF and BLOOD_COLLECTION_STAFF assignments into it.
-- ---------------------------------------------------------------------------

UPDATE "Role" SET "code" = 'DONATION_STAFF', "name" = 'Nhân viên tiếp nhận / sàng lọc'
WHERE "code" = 'RECEPTION_STAFF';

-- If there was no RECEPTION_STAFF row to rename (fresh/edge-case DB), make
-- sure DONATION_STAFF exists before repointing the other two roles into it.
INSERT INTO "Role" ("id", "createdAt", "updatedAt", "code", "name", "description")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'DONATION_STAFF', 'Nhân viên tiếp nhận / sàng lọc', NULL
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "code" = 'DONATION_STAFF');

INSERT INTO "UserRole" ("id", "createdAt", "updatedAt", "userId", "roleId")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ur."userId", target."id"
FROM "UserRole" ur
JOIN "Role" legacy ON legacy."id" = ur."roleId" AND legacy."code" IN ('MEDICAL_STAFF', 'BLOOD_COLLECTION_STAFF')
CROSS JOIN (SELECT "id" FROM "Role" WHERE "code" = 'DONATION_STAFF') AS target
ON CONFLICT ("userId", "roleId") DO NOTHING;

DELETE FROM "UserRole"
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "code" IN ('MEDICAL_STAFF', 'BLOOD_COLLECTION_STAFF'));

DELETE FROM "Role" WHERE "code" IN ('MEDICAL_STAFF', 'BLOOD_COLLECTION_STAFF');

-- ---------------------------------------------------------------------------
-- 3. Introduce the new COORDINATOR role (no legacy equivalent — it is a
--    standalone actor, never merged into SYSTEM_ADMIN).
-- ---------------------------------------------------------------------------

INSERT INTO "Role" ("id", "createdAt", "updatedAt", "code", "name", "description")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'COORDINATOR', 'Điều phối viên', NULL
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "code" = 'COORDINATOR');
