-- CreateTable
CREATE TABLE "item_attributes" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "numericValues" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_attribute_values" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "attributeValue" VARCHAR(255) NOT NULL,
    "abbreviation" VARCHAR(50) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_attributes_name_idx" ON "item_attributes"("name");

-- CreateIndex
CREATE INDEX "item_attributes_disabled_idx" ON "item_attributes"("disabled");

-- CreateIndex
CREATE UNIQUE INDEX "item_attribute_values_attributeId_attributeValue_key" ON "item_attribute_values"("attributeId", "attributeValue");

-- CreateIndex
CREATE INDEX "item_attribute_values_attributeId_idx" ON "item_attribute_values"("attributeId");

-- AddForeignKey
ALTER TABLE "item_attribute_values" ADD CONSTRAINT "item_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "item_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
