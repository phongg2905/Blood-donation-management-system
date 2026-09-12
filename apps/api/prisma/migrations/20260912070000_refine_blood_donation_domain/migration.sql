-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodBagStatus" AS ENUM ('CREATED', 'COLLECTED', 'PENDING_TEST', 'TESTED', 'ACCEPTED', 'REJECTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RegistrationStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "RegistrationStatus" ADD VALUE 'WAITLISTED';
ALTER TYPE "RegistrationStatus" ADD VALUE 'NO_SHOW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScreeningStatus" ADD VALUE 'WAITING_REVIEW';
ALTER TYPE "ScreeningStatus" ADD VALUE 'DEFERRED';

-- AlterTable
ALTER TABLE "BloodBag" ADD COLUMN     "status" "BloodBagStatus" NOT NULL DEFAULT 'CREATED';

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "revokeReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMPTZ(3),
ADD COLUMN     "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "checkedInById" UUID;

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "completedAt" TIMESTAMPTZ(3),
ADD COLUMN     "performedById" UUID,
ADD COLUMN     "startedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DonationCampaign" ADD COLUMN     "description" TEXT,
ADD COLUMN     "registrationClosesAt" TIMESTAMPTZ(3),
ADD COLUMN     "registrationOpensAt" TIMESTAMPTZ(3),
ADD COLUMN     "targetBloodVolumeMl" INTEGER,
ADD COLUMN     "targetDonors" INTEGER;

-- AlterTable
ALTER TABLE "DonorProfile" ADD COLUMN     "address" TEXT,
ADD COLUMN     "citizenId" TEXT,
ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "HealthDeclaration" ADD COLUMN     "answers" JSONB;

-- AlterTable
ALTER TABLE "Screening" ADD COLUMN     "decisionReason" TEXT,
ADD COLUMN     "deferredUntil" DATE,
ADD COLUMN     "screenedById" UUID;

-- AlterTable
ALTER TABLE "ScreeningTest" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "referenceRange" TEXT,
ADD COLUMN     "unit" TEXT;

-- CreateIndex
CREATE INDEX "BloodBag_status_idx" ON "BloodBag"("status");

-- CreateIndex
CREATE INDEX "CheckIn_checkedInById_idx" ON "CheckIn"("checkedInById");

-- CreateIndex
CREATE INDEX "Donation_performedById_idx" ON "Donation"("performedById");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "DonationCampaign_status_startsAt_idx" ON "DonationCampaign"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonorProfile_citizenId_key" ON "DonorProfile"("citizenId");

-- CreateIndex
CREATE INDEX "Registration_campaignId_status_idx" ON "Registration"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Screening_screenedById_idx" ON "Screening"("screenedById");

-- CreateIndex
CREATE INDEX "Screening_status_idx" ON "Screening"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningTest_screeningId_code_key" ON "ScreeningTest"("screeningId", "code");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screening" ADD CONSTRAINT "Screening_screenedById_fkey" FOREIGN KEY ("screenedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
