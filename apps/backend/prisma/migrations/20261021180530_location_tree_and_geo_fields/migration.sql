-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_parentLocationId_fkey";

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "area" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "areaUom" VARCHAR(50),
ADD COLUMN     "geolocation" JSONB,
ADD COLUMN     "isContainer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
