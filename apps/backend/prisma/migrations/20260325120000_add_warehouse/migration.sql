-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "isGroupWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "parentWarehouseId" TEXT,
    "company" VARCHAR(255) NOT NULL,
    "isRejectedWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "phoneNo" VARCHAR(50),
    "mobileNo" VARCHAR(50),
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(255),
    "state" VARCHAR(255),
    "pin" VARCHAR(20),
    "warehouseType" VARCHAR(100),
    "defaultInTransitWarehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");

-- CreateIndex
CREATE INDEX "warehouses_company_idx" ON "warehouses"("company");

-- CreateIndex
CREATE INDEX "warehouses_disabled_idx" ON "warehouses"("disabled");

-- CreateIndex
CREATE INDEX "warehouses_isGroupWarehouse_idx" ON "warehouses"("isGroupWarehouse");

-- CreateIndex
CREATE INDEX "warehouses_parentWarehouseId_idx" ON "warehouses"("parentWarehouseId");

-- CreateIndex
CREATE INDEX "warehouses_defaultInTransitWarehouseId_idx" ON "warehouses"("defaultInTransitWarehouseId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_parentWarehouseId_fkey" FOREIGN KEY ("parentWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_defaultInTransitWarehouseId_fkey" FOREIGN KEY ("defaultInTransitWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;