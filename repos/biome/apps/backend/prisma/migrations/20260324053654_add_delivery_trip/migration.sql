-- CreateEnum
CREATE TYPE "DeliveryTripStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "delivery_trips" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "seriesPattern" VARCHAR(50) NOT NULL DEFAULT 'MAT-DT-.YYYY.-',
    "status" "DeliveryTripStatus" NOT NULL DEFAULT 'DRAFT',
    "company" VARCHAR(255) NOT NULL,
    "driver" VARCHAR(255),
    "driverAddress" VARCHAR(500),
    "vehicle" VARCHAR(255),
    "departureTime" TIMESTAMP(3),
    "initialEmailNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_trip_stops" (
    "id" TEXT NOT NULL,
    "deliveryTripId" TEXT NOT NULL,
    "stopNumber" INTEGER NOT NULL,
    "customer" VARCHAR(255),
    "addressName" VARCHAR(500) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "deliveryNote" VARCHAR(50),
    "estimatedArrival" TIMESTAMP(3),

    CONSTRAINT "delivery_trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_trips_series_key" ON "delivery_trips"("series");

-- CreateIndex
CREATE INDEX "delivery_trips_series_idx" ON "delivery_trips"("series");

-- CreateIndex
CREATE INDEX "delivery_trips_status_idx" ON "delivery_trips"("status");

-- CreateIndex
CREATE INDEX "delivery_trip_stops_deliveryTripId_idx" ON "delivery_trip_stops"("deliveryTripId");

-- AddForeignKey
ALTER TABLE "delivery_trip_stops" ADD CONSTRAINT "delivery_trip_stops_deliveryTripId_fkey" FOREIGN KEY ("deliveryTripId") REFERENCES "delivery_trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
