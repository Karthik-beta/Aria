-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "abbreviation" VARCHAR(50),
    "country" VARCHAR(100),
    "currency" VARCHAR(50),
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "year" VARCHAR(20) NOT NULL,
    "yearStartDate" TIMESTAMP(3) NOT NULL,
    "yearEndDate" TIMESTAMP(3) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "isShortYear" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYearCompany" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "FiscalYearCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_year_key" ON "FiscalYear"("year");

-- CreateIndex
CREATE INDEX "FiscalYear_year_idx" ON "FiscalYear"("year");

-- CreateIndex
CREATE INDEX "FiscalYear_yearStartDate_yearEndDate_idx" ON "FiscalYear"("yearStartDate", "yearEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYearCompany_fiscalYearId_companyId_key" ON "FiscalYearCompany"("fiscalYearId", "companyId");

-- AddForeignKey
ALTER TABLE "FiscalYearCompany" ADD CONSTRAINT "FiscalYearCompany_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYearCompany" ADD CONSTRAINT "FiscalYearCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
