CREATE TYPE "SupplierPurchaseOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

CREATE TABLE "SupplierPurchaseOrder" (
  "id" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "procurementRequestId" TEXT,
  "status" "SupplierPurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDate" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierPurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPurchaseOrderLine" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "requestedQty" DECIMAL(12,2) NOT NULL,
  "orderedQty" DECIMAL(12,2) NOT NULL,
  "receivedQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "uom" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierPurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoodsReceipt" (
  "id" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoodsReceiptLine" (
  "id" TEXT NOT NULL,
  "goodsReceiptId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "receivedQty" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DowntimeReason" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DowntimeReason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionEntry" (
  "id" TEXT NOT NULL,
  "metricDate" TIMESTAMP(3) NOT NULL,
  "lineId" TEXT NOT NULL,
  "orderId" TEXT,
  "shiftId" TEXT,
  "stage" "ProductionStageCode" NOT NULL,
  "plannedQty" INTEGER NOT NULL,
  "actualQty" INTEGER NOT NULL,
  "rejectedQty" INTEGER NOT NULL DEFAULT 0,
  "downtimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "downtimeReasonId" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorrectiveAction" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT,
  "vendorId" TEXT,
  "orderId" TEXT,
  "lineId" TEXT,
  "title" TEXT NOT NULL,
  "rootCause" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPurchaseOrder_poNumber_key" ON "SupplierPurchaseOrder"("poNumber");
CREATE UNIQUE INDEX "DowntimeReason_code_key" ON "DowntimeReason"("code");
CREATE UNIQUE INDEX "DowntimeReason_label_key" ON "DowntimeReason"("label");
CREATE UNIQUE INDEX "GoodsReceipt_receiptNumber_key" ON "GoodsReceipt"("receiptNumber");

ALTER TABLE "SupplierPurchaseOrder"
  ADD CONSTRAINT "SupplierPurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierPurchaseOrder_procurementRequestId_fkey"
  FOREIGN KEY ("procurementRequestId") REFERENCES "ProcurementRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierPurchaseOrderLine"
  ADD CONSTRAINT "SupplierPurchaseOrderLine_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "SupplierPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SupplierPurchaseOrderLine_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt"
  ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "SupplierPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoodsReceiptLine"
  ADD CONSTRAINT "GoodsReceiptLine_goodsReceiptId_fkey"
  FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GoodsReceiptLine_purchaseOrderLineId_fkey"
  FOREIGN KEY ("purchaseOrderLineId") REFERENCES "SupplierPurchaseOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionEntry"
  ADD CONSTRAINT "ProductionEntry_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductionEntry_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductionEntry_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductionEntry_downtimeReasonId_fkey"
  FOREIGN KEY ("downtimeReasonId") REFERENCES "DowntimeReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CorrectiveAction"
  ADD CONSTRAINT "CorrectiveAction_inspectionId_fkey"
  FOREIGN KEY ("inspectionId") REFERENCES "QaInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CorrectiveAction_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CorrectiveAction_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CorrectiveAction_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
