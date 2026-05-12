CREATE TYPE "AssetEntityType" AS ENUM ('STYLE', 'STYLE_SAMPLE', 'ORDER');
CREATE TYPE "AssetKind" AS ENUM ('SAMPLE_IMAGE', 'REFERENCE_IMAGE', 'TECH_PACK', 'ATTACHMENT');
CREATE TYPE "StyleSampleType" AS ENUM ('PROTO', 'FIT', 'SIZE_SET', 'PP', 'SHIPMENT');
CREATE TYPE "StyleSampleStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISED');

ALTER TABLE "StyleColor"
  ADD COLUMN "pantoneCode" TEXT,
  ADD COLUMN "threadCode" TEXT,
  ADD COLUMN "notes" TEXT;

CREATE TABLE "FileAsset" (
  "id" TEXT NOT NULL,
  "entityType" "AssetEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "kind" "AssetKind" NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StyleSample" (
  "id" TEXT NOT NULL,
  "styleId" TEXT NOT NULL,
  "sampleType" "StyleSampleType" NOT NULL,
  "status" "StyleSampleStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StyleSample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StyleSampleAsset" (
  "id" TEXT NOT NULL,
  "sampleId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StyleSampleAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StyleMeasurementSpec" (
  "id" TEXT NOT NULL,
  "styleId" TEXT NOT NULL,
  "sizeLabel" TEXT NOT NULL,
  "measurementPoint" TEXT NOT NULL,
  "targetValue" DECIMAL(10,2) NOT NULL,
  "tolerancePlus" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "toleranceMinus" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StyleMeasurementSpec_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StyleThreadSpec" (
  "id" TEXT NOT NULL,
  "styleId" TEXT NOT NULL,
  "materialName" TEXT NOT NULL,
  "countSpec" TEXT NOT NULL,
  "colorRef" TEXT,
  "supplierId" TEXT,
  "materialId" TEXT,
  "processNotes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StyleThreadSpec_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StyleSampleAsset_sampleId_assetId_key" ON "StyleSampleAsset"("sampleId", "assetId");
CREATE UNIQUE INDEX "StyleMeasurementSpec_styleId_sizeLabel_measurementPoint_key" ON "StyleMeasurementSpec"("styleId", "sizeLabel", "measurementPoint");
CREATE INDEX "FileAsset_entityType_entityId_idx" ON "FileAsset"("entityType", "entityId");

ALTER TABLE "FileAsset"
  ADD CONSTRAINT "FileAsset_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StyleSample"
  ADD CONSTRAINT "StyleSample_styleId_fkey"
  FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StyleSample_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StyleSampleAsset"
  ADD CONSTRAINT "StyleSampleAsset_sampleId_fkey"
  FOREIGN KEY ("sampleId") REFERENCES "StyleSample"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StyleSampleAsset_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StyleMeasurementSpec"
  ADD CONSTRAINT "StyleMeasurementSpec_styleId_fkey"
  FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StyleThreadSpec"
  ADD CONSTRAINT "StyleThreadSpec_styleId_fkey"
  FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StyleThreadSpec_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "StyleThreadSpec_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
