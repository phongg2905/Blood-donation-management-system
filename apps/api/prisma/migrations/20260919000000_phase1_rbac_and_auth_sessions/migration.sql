-- Phase 1: normalize RBAC to the five-role model and add the auth-session
-- foundation. Only token hashes are stored; there is no plain-text column.
--
-- Prisma already wraps each migration in a transaction, so no explicit
-- BEGIN/COMMIT is used here.

-- ---------------------------------------------------------------------------
-- 1. Merge legacy roles into the five-role model.
--    SCREENING_STAFF + DOCTOR -> MEDICAL_STAFF
--    COORDINATOR + ADMIN      -> ADMIN
-- ---------------------------------------------------------------------------

INSERT INTO "Role" ("id", "createdAt", "updatedAt", "code", "name", "description")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'MEDICAL_STAFF', 'MEDICAL_STAFF', 'Nhân viên y tế'
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "code" = 'MEDICAL_STAFF');

-- Re-point assignments from SCREENING_STAFF / DOCTOR to MEDICAL_STAFF.
INSERT INTO "UserRole" ("id", "createdAt", "updatedAt", "userId", "roleId")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ur."userId", target."id"
FROM "UserRole" ur
JOIN "Role" legacy ON legacy."id" = ur."roleId" AND legacy."code" IN ('SCREENING_STAFF', 'DOCTOR')
CROSS JOIN (SELECT "id" FROM "Role" WHERE "code" = 'MEDICAL_STAFF') AS target
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Re-point assignments from COORDINATOR to ADMIN.
INSERT INTO "UserRole" ("id", "createdAt", "updatedAt", "userId", "roleId")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ur."userId", target."id"
FROM "UserRole" ur
JOIN "Role" legacy ON legacy."id" = ur."roleId" AND legacy."code" = 'COORDINATOR'
CROSS JOIN (SELECT "id" FROM "Role" WHERE "code" = 'ADMIN') AS target
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Drop the stale assignments, then the legacy roles (RolePermission cascades).
DELETE FROM "UserRole"
WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "code" IN ('SCREENING_STAFF', 'DOCTOR', 'COORDINATOR'));

DELETE FROM "Role" WHERE "code" IN ('SCREENING_STAFF', 'DOCTOR', 'COORDINATOR');

-- ---------------------------------------------------------------------------
-- 2. Refresh-token session table.
-- ---------------------------------------------------------------------------

CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "replacedById" UUID,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Password reset token table.
-- ---------------------------------------------------------------------------

CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
