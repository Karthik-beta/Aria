/*
  Warnings:

  - You are about to drop the column `sku` on the `inventory_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `inventory_items` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `inventory_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."inventory_items_sku_idx";

-- DropIndex
DROP INDEX "public"."inventory_items_sku_key";

-- AlterTable
ALTER TABLE "inventory_items" DROP COLUMN "sku",
ADD COLUMN     "allowAlternateItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "code" VARCHAR(100) NOT NULL,
ADD COLUMN     "defaultUnitOfMeasureId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "itemGroupId" TEXT,
ADD COLUMN     "maintainStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_code_key" ON "inventory_items"("code");

-- CreateIndex
CREATE INDEX "inventory_items_code_idx" ON "inventory_items"("code");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_itemGroupId_fkey" FOREIGN KEY ("itemGroupId") REFERENCES "ItemGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_defaultUnitOfMeasureId_fkey" FOREIGN KEY ("defaultUnitOfMeasureId") REFERENCES "UnitOfMeasurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
