-- CreateTable
CREATE TABLE "item_variant_settings" (
    "id" TEXT NOT NULL,
    "singletonKey" VARCHAR(32) NOT NULL DEFAULT 'default',
    "doNotUpdateVariantsOnSave" BOOLEAN NOT NULL DEFAULT false,
    "allowRenameAttributeValue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_variant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_variant_settings_fields" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "fieldKey" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_variant_settings_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_variant_settings_singletonKey_key" ON "item_variant_settings"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "item_variant_settings_fields_settingsId_fieldKey_key" ON "item_variant_settings_fields"("settingsId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "item_variant_settings_fields_settingsId_position_key" ON "item_variant_settings_fields"("settingsId", "position");

-- CreateIndex
CREATE INDEX "item_variant_settings_fields_settingsId_idx" ON "item_variant_settings_fields"("settingsId");

-- AddForeignKey
ALTER TABLE "item_variant_settings_fields" ADD CONSTRAINT "item_variant_settings_fields_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "item_variant_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;