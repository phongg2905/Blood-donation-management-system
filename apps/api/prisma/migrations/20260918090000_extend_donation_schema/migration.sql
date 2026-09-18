-- Apply atomically; invalid legacy assignments abort without losing data.
BEGIN;

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "CampaignAssignment" AS ENUM ('CHECK_IN', 'SCREENING', 'COLLECTION', 'SUPPORT');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('WHOLE_BLOOD', 'PLASMA', 'PLATELETS');

-- CreateEnum
CREATE TYPE "BloodComponent" AS ENUM ('WHOLE_BLOOD', 'RED_BLOOD_CELLS', 'PLASMA', 'PLATELETS');

-- CreateEnum
CREATE TYPE "ReactionSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('GENERAL', 'REGISTRATION', 'CAMPAIGN', 'DONATION', 'CERTIFICATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "DonorProfile" ADD COLUMN     "bloodType" "BloodType",
ADD COLUMN     "emergencyName" TEXT,
ADD COLUMN     "emergencyPhone" TEXT;

-- AlterTable
ALTER TABLE "DonationCampaign" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "organizerName" TEXT;

-- AlterTable
ALTER TABLE "CampaignTimeSlot" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "CampaignStaff" ALTER COLUMN "assignment" TYPE "CampaignAssignment"
USING "assignment"::"CampaignAssignment";

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "HealthDeclaration" ADD COLUMN     "questionnaireVersion" TEXT;

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Screening" ADD COLUMN     "diastolicBp" INTEGER,
ADD COLUMN     "hemoglobin" DECIMAL(5,2),
ADD COLUMN     "pulse" INTEGER,
ADD COLUMN     "systolicBp" INTEGER,
ADD COLUMN     "temperatureC" DECIMAL(4,2),
ADD COLUMN     "weightKg" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "ScreeningTest" ADD COLUMN     "isPassed" BOOLEAN,
ADD COLUMN     "numericValue" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "donationType" "DonationType" NOT NULL DEFAULT 'WHOLE_BLOOD',
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "BloodBag" ADD COLUMN     "bloodType" "BloodType",
ADD COLUMN     "collectedAt" TIMESTAMPTZ(3),
ADD COLUMN     "component" "BloodComponent" NOT NULL DEFAULT 'WHOLE_BLOOD',
ADD COLUMN     "expiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "storageLocation" TEXT;

-- AlterTable
ALTER TABLE "PostDonationReaction" ADD COLUMN     "actionTaken" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMPTZ(3),
ADD COLUMN     "severity" "ReactionSeverity";

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
ADD COLUMN     "sentAt" TIMESTAMPTZ(3),
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "userAgent" TEXT;

-- Preserve the legacy timestamp before removing its column.
UPDATE "AuditLog"
SET "metadata" = jsonb_build_object('legacyUpdatedAt', "updatedAt");
ALTER TABLE "AuditLog" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "category" TEXT,
ADD COLUMN     "valueType" TEXT;

-- CreateIndex
CREATE INDEX "DonorProfile_bloodType_idx" ON "DonorProfile"("bloodType");

-- CreateIndex
CREATE INDEX "Donation_donationType_idx" ON "Donation"("donationType");

-- CreateIndex
CREATE INDEX "BloodBag_bloodType_idx" ON "BloodBag"("bloodType");

-- CreateIndex
CREATE INDEX "BloodBag_status_expiresAt_idx" ON "BloodBag"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PostDonationReaction_severity_idx" ON "PostDonationReaction"("severity");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

COMMIT;
