CREATE TABLE "productionCategorySnapshot" (
  "id" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "membershipDigest" TEXT NOT NULL,
  "propertyCount" INTEGER NOT NULL,
  "membershipCount" INTEGER NOT NULL,
  "linkedPropertyCount" INTEGER NOT NULL,
  "unresolvedPropertyCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "productionCategorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "productionCategoryState" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "productionCategoryState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "productionCategoryState_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "productionCategorySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "productionCoreCategory" (
  "snapshotId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "productionCoreCategory_pkey" PRIMARY KEY ("snapshotId", "categoryId"),
  CONSTRAINT "productionCoreCategory_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "productionCategorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "productionCategoryMembership" (
  "snapshotId" TEXT NOT NULL,
  "productionPropertyId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "companyId" TEXT,
  CONSTRAINT "productionCategoryMembership_pkey" PRIMARY KEY ("snapshotId", "productionPropertyId", "categoryId"),
  CONSTRAINT "productionCategoryMembership_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "productionCategorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "productionCategoryMembership_snapshotId_categoryId_fkey" FOREIGN KEY ("snapshotId", "categoryId") REFERENCES "productionCoreCategory"("snapshotId", "categoryId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "productionCategoryMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "categoryMembership_company_snapshot_category_idx" ON "productionCategoryMembership"("companyId", "snapshotId", "categoryId");
CREATE INDEX "categoryMembership_snapshot_category_company_idx" ON "productionCategoryMembership"("snapshotId", "categoryId", "companyId");
INSERT INTO "productionCategoryState" ("id") VALUES ('core');
