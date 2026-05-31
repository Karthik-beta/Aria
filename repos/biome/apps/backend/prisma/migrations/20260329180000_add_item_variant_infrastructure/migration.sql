-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "templateItemId" TEXT;

-- CreateTable
CREATE TABLE "inventory_item_attributes" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "attributeValue" VARCHAR(255) NOT NULL,

    CONSTRAINT "inventory_item_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_items_templateItemId_idx" ON "inventory_items"("templateItemId");

-- CreateIndex
CREATE INDEX "inventory_item_attributes_itemId_idx" ON "inventory_item_attributes"("itemId");

-- CreateIndex
CREATE INDEX "inventory_item_attributes_attributeId_idx" ON "inventory_item_attributes"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_attributes_itemId_attributeId_key" ON "inventory_item_attributes"("itemId", "attributeId");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_attributes" ADD CONSTRAINT "inventory_item_attributes_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_attributes" ADD CONSTRAINT "inventory_item_attributes_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "item_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
