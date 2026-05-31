-- AlterTable
ALTER TABLE "ItemGroup" ADD COLUMN     "isGroup" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "item_group_defaults" (
    "id" TEXT NOT NULL,
    "itemGroupId" TEXT NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "defaultWarehouse" VARCHAR(255),
    "defaultPriceList" VARCHAR(255),

    CONSTRAINT "item_group_defaults_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "item_group_defaults" ADD CONSTRAINT "item_group_defaults_itemGroupId_fkey" FOREIGN KEY ("itemGroupId") REFERENCES "ItemGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "item_manufacturers_itemId_manufacturer_manufacturerPartNumber_k" RENAME TO "item_manufacturers_itemId_manufacturer_manufacturerPartNumb_key";
