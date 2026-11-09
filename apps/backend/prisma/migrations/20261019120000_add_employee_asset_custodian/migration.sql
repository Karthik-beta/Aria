-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LEFT');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeId" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255),
    "department" VARCHAR(255),
    "designation" VARCHAR(255),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeId_key" ON "employees"("employeeId");

-- CreateIndex
CREATE INDEX "employees_employeeName_idx" ON "employees"("employeeName");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- AlterTable
ALTER TABLE "assets" ADD COLUMN "custodianId" TEXT;

-- Backfill: promote each distinct free-text custodian into an Employee record
-- so existing assets keep their custodian after the column becomes a link.
INSERT INTO "employees" ("id", "employeeId", "employeeName", "updatedAt")
SELECT
    'c' || md5(c."custodian"),
    'HR-EMP-' || lpad(c."rn"::text, 5, '0'),
    c."custodian",
    CURRENT_TIMESTAMP
FROM (
    SELECT "custodian", row_number() OVER (ORDER BY "custodian") AS "rn"
    FROM (
        SELECT DISTINCT trim("custodian") AS "custodian"
        FROM "assets"
        WHERE "custodian" IS NOT NULL AND trim("custodian") <> ''
    ) d
) c;

UPDATE "assets" a
SET "custodianId" = 'c' || md5(trim(a."custodian"))
WHERE a."custodian" IS NOT NULL AND trim(a."custodian") <> '';

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "custodian";

-- CreateIndex
CREATE INDEX "assets_custodianId_idx" ON "assets"("custodianId");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
