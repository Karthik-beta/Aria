-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "depreciationStartDate" TIMESTAMP(3),
ADD COLUMN     "expectedValueAfterUsefulLife" DECIMAL(18,6);
