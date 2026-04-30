CREATE TYPE "ProcurementRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

CREATE TABLE "ProcurementRequest" (
  "id" TEXT PRIMARY KEY,
  "materialId" TEXT NOT NULL,
  "supplierId" TEXT,
  "createdByUserId" TEXT,
  "shortageQty" DECIMAL(12,2) NOT NULL,
  "requestedQty" DECIMAL(12,2) NOT NULL,
  "note" TEXT NOT NULL,
  "status" "ProcurementRequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcurementRequest_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProcurementRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProcurementRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ProcurementRequest_materialId_status_idx" ON "ProcurementRequest"("materialId", "status");
CREATE INDEX "ProcurementRequest_supplierId_status_idx" ON "ProcurementRequest"("supplierId", "status");
