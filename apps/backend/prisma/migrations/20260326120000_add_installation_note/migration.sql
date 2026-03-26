CREATE TYPE "InstallationNoteStatus" AS ENUM (
    'DRAFT',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);

CREATE TABLE "installation_notes" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "seriesPattern" VARCHAR(50) NOT NULL DEFAULT 'MAT-INS-.YYYY.-',
    "installationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installationTime" VARCHAR(8),
    "customer" VARCHAR(255) NOT NULL,
    "customerName" VARCHAR(255),
    "customerAddress" VARCHAR(255),
    "contactPerson" VARCHAR(255),
    "territory" VARCHAR(255) NOT NULL DEFAULT 'All Territories',
    "customerGroup" VARCHAR(255),
    "company" VARCHAR(255) NOT NULL,
    "status" "InstallationNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "deliveryNoteId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installation_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "installation_note_items" (
    "id" TEXT NOT NULL,
    "installationNoteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "serialNoId" TEXT,
    "description" TEXT,
    "installedQty" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "installation_note_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "installation_notes_series_key" ON "installation_notes"("series");
CREATE INDEX "installation_notes_installationDate_idx" ON "installation_notes"("installationDate");
CREATE INDEX "installation_notes_status_idx" ON "installation_notes"("status");
CREATE INDEX "installation_notes_customer_idx" ON "installation_notes"("customer");
CREATE INDEX "installation_notes_company_idx" ON "installation_notes"("company");
CREATE INDEX "installation_notes_deliveryNoteId_idx" ON "installation_notes"("deliveryNoteId");

CREATE INDEX "installation_note_items_installationNoteId_idx" ON "installation_note_items"("installationNoteId");
CREATE INDEX "installation_note_items_itemId_idx" ON "installation_note_items"("itemId");
CREATE INDEX "installation_note_items_serialNoId_idx" ON "installation_note_items"("serialNoId");
CREATE UNIQUE INDEX "installation_note_items_installationNoteId_serialNoId_key"
ON "installation_note_items"("installationNoteId", "serialNoId");

ALTER TABLE "installation_notes"
    ADD CONSTRAINT "installation_notes_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "installation_note_items"
    ADD CONSTRAINT "installation_note_items_installationNoteId_fkey"
    FOREIGN KEY ("installationNoteId") REFERENCES "installation_notes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "installation_note_items"
    ADD CONSTRAINT "installation_note_items_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "installation_note_items"
    ADD CONSTRAINT "installation_note_items_serialNoId_fkey"
    FOREIGN KEY ("serialNoId") REFERENCES "serial_nos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
