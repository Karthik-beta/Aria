-- CreateTable
CREATE TABLE "asset_maintenance_teams" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "maintenanceManager" VARCHAR(255),
    "maintenanceManagerName" VARCHAR(255),
    "company" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenance_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance_team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamMember" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "maintenanceRole" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenance_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_maintenance_teams_name_key" ON "asset_maintenance_teams"("name");

-- CreateIndex
CREATE INDEX "asset_maintenance_teams_name_idx" ON "asset_maintenance_teams"("name");

-- CreateIndex
CREATE INDEX "asset_maintenance_teams_company_idx" ON "asset_maintenance_teams"("company");

-- CreateIndex
CREATE INDEX "asset_maintenance_team_members_teamId_idx" ON "asset_maintenance_team_members"("teamId");

-- AddForeignKey
ALTER TABLE "asset_maintenance_team_members" ADD CONSTRAINT "asset_maintenance_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "asset_maintenance_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
