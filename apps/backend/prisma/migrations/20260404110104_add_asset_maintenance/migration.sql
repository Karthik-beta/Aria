-- CreateEnum
CREATE TYPE "AssetMaintenanceStatus" AS ENUM ('PLANNED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetMaintenanceLogStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AssetMaintenanceTaskType" AS ENUM ('PREVENTIVE_MAINTENANCE', 'CALIBRATION');

-- CreateEnum
CREATE TYPE "AssetMaintenancePeriodicity" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'TWO_YEARLY', 'THREE_YEARLY');

-- CreateTable
CREATE TABLE "asset_maintenances" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "maintenanceTeamId" TEXT NOT NULL,
    "maintenanceManager" VARCHAR(255),
    "maintenanceManagerName" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_tasks" (
    "id" TEXT NOT NULL,
    "maintenanceId" TEXT NOT NULL,
    "maintenanceTask" VARCHAR(255) NOT NULL,
    "maintenanceType" "AssetMaintenanceTaskType",
    "maintenanceStatus" "AssetMaintenanceStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "periodicity" "AssetMaintenancePeriodicity" NOT NULL,
    "endDate" TIMESTAMP(3),
    "certificateRequired" BOOLEAN NOT NULL DEFAULT false,
    "assignTo" VARCHAR(255),
    "assignToName" VARCHAR(255),
    "nextDueDate" TIMESTAMP(3),
    "lastCompletionDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_logs" (
    "id" TEXT NOT NULL,
    "maintenanceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "maintenanceStatus" "AssetMaintenanceLogStatus" NOT NULL DEFAULT 'PLANNED',
    "completionDate" TIMESTAMP(3),
    "actionsPerformed" TEXT,
    "hasCertificate" BOOLEAN NOT NULL DEFAULT false,
    "certificateAttachment" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_maintenances_assetId_key" ON "asset_maintenances"("assetId");

-- CreateIndex
CREATE INDEX "asset_maintenances_maintenanceTeamId_idx" ON "asset_maintenances"("maintenanceTeamId");

-- CreateIndex
CREATE INDEX "asset_maintenances_company_idx" ON "asset_maintenances"("company");

-- CreateIndex
CREATE INDEX "asset_maintenance_tasks_maintenanceId_idx" ON "asset_maintenance_tasks"("maintenanceId");

-- CreateIndex
CREATE INDEX "asset_maintenance_tasks_maintenanceStatus_idx" ON "asset_maintenance_tasks"("maintenanceStatus");

-- CreateIndex
CREATE INDEX "asset_maintenance_tasks_nextDueDate_idx" ON "asset_maintenance_tasks"("nextDueDate");

-- CreateIndex
CREATE INDEX "asset_maintenance_logs_maintenanceId_idx" ON "asset_maintenance_logs"("maintenanceId");

-- CreateIndex
CREATE INDEX "asset_maintenance_logs_taskId_idx" ON "asset_maintenance_logs"("taskId");

-- CreateIndex
CREATE INDEX "asset_maintenance_logs_maintenanceStatus_idx" ON "asset_maintenance_logs"("maintenanceStatus");

-- AddForeignKey
ALTER TABLE "asset_maintenances" ADD CONSTRAINT "asset_maintenances_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenances" ADD CONSTRAINT "asset_maintenances_maintenanceTeamId_fkey" FOREIGN KEY ("maintenanceTeamId") REFERENCES "asset_maintenance_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_tasks" ADD CONSTRAINT "asset_maintenance_tasks_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "asset_maintenances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_logs" ADD CONSTRAINT "asset_maintenance_logs_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "asset_maintenances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance_logs" ADD CONSTRAINT "asset_maintenance_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "asset_maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
