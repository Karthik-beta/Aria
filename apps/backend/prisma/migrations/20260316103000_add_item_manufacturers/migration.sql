-- CreateTable
CREATE TABLE "item_manufacturers" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "manufacturer" VARCHAR(255) NOT NULL,
    "manufacturerPartNumber" VARCHAR(255) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_manufacturers_itemId_idx" ON "item_manufacturers"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "item_manufacturers_itemId_manufacturer_manufacturerPartNumber_key" ON "item_manufacturers"("itemId", "manufacturer", "manufacturerPartNumber");

-- AddForeignKey
ALTER TABLE "item_manufacturers" ADD CONSTRAINT "item_manufacturers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
