/*
  Warnings:

  - Added the required column `categoryGroup` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryName` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "products_category_idx";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "categoryGroup" TEXT NOT NULL,
ADD COLUMN     "categoryName" TEXT NOT NULL,
ADD COLUMN     "isNew" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "products_categoryName_idx" ON "products"("categoryName");

-- CreateIndex
CREATE INDEX "products_isActive_categoryName_idx" ON "products"("isActive", "categoryName");
