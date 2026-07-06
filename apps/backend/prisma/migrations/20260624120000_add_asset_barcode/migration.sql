-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "barcode" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "assets_barcode_key" ON "assets"("barcode");
