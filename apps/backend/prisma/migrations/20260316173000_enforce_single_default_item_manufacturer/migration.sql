-- Enforce at-most-one default manufacturer per item.
CREATE UNIQUE INDEX "item_manufacturers_itemId_default_unique"
ON "item_manufacturers"("itemId")
WHERE "isDefault" = true;
