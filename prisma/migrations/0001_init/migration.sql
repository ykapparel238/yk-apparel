CREATE TYPE "UserRole" AS ENUM (
  'ADMIN',
  'FACTORY_MANAGER',
  'PRODUCTION_PLANNER',
  'MERCHANDISER',
  'QA_MANAGER',
  'STORE_MANAGER',
  'LINE_SUPERVISOR',
  'VENDOR_MANAGER',
  'DISPATCH_MANAGER'
);

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PLANNED', 'IN_PRODUCTION', 'QA', 'DISPATCHED', 'DELAYED');
CREATE TYPE "OrderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ChallanStatus" AS ENUM ('OPEN', 'PARTIAL', 'CLOSED');
CREATE TYPE "MaterialType" AS ENUM ('YARN', 'TRIM', 'LABEL', 'PACKING', 'OTHER');
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProductionStageCode" AS ENUM (
  'YARN_INWARD',
  'KNITTING',
  'LINKING',
  'WASHING',
  'DRYING',
  'FINISHING',
  'IRONING',
  'QUALITY_CHECK',
  'PACKING',
  'DISPATCH'
);
CREATE TYPE "DispatchStatus" AS ENUM ('READY', 'SCHEDULED', 'DISPATCHED', 'CANCELLED');
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

CREATE TABLE "Department" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "headName" TEXT,
  "staffCount" INTEGER,
  "lineCount" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Shift" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "supervisorName" TEXT,
  "headcount" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "employeeCode" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "role" "UserRole" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "departmentId" TEXT,
  "shiftId" TEXT,
  "lastActiveAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "User_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Brand" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE,
  "countryCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Supplier" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE,
  "defaultMaterial" TEXT,
  "leadTimeDays" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Material" (
  "id" TEXT PRIMARY KEY,
  "sku" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "type" "MaterialType" NOT NULL,
  "uom" TEXT NOT NULL,
  "stockQty" DECIMAL(12,2) NOT NULL,
  "allocatedQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "reorderLevel" DECIMAL(12,2) NOT NULL,
  "supplierId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Material_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Vendor" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE,
  "process" TEXT NOT NULL,
  "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
  "capacityPerDay" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ProductionLine" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE,
  "process" TEXT NOT NULL,
  "gauge" TEXT NOT NULL,
  "machineCount" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Style" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "brandId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gauge" TEXT NOT NULL,
  "yarnDescription" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Style_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StyleSize" (
  "id" TEXT PRIMARY KEY,
  "styleId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "StyleSize_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StyleSize_styleId_label_key" UNIQUE ("styleId", "label")
);

CREATE TABLE "StyleColor" (
  "id" TEXT PRIMARY KEY,
  "styleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "hexCode" TEXT,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "StyleColor_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StyleColor_styleId_name_key" UNIQUE ("styleId", "name")
);

CREATE TABLE "BillOfMaterialItem" (
  "id" TEXT PRIMARY KEY,
  "styleId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "quantityPerPiece" DECIMAL(10,2) NOT NULL,
  "uom" TEXT NOT NULL,
  CONSTRAINT "BillOfMaterialItem_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BillOfMaterialItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BillOfMaterialItem_styleId_materialId_key" UNIQUE ("styleId", "materialId")
);

CREATE TABLE "PurchaseOrder" (
  "id" TEXT PRIMARY KEY,
  "poNumber" TEXT NOT NULL UNIQUE,
  "brandId" TEXT NOT NULL,
  "styleId" TEXT NOT NULL,
  "seasonCode" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "deliveredQty" INTEGER NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP NOT NULL,
  "orderDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
  "priority" "OrderPriority" NOT NULL DEFAULT 'MEDIUM',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrder_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PurchaseOrderSizeAllocation" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "sizeLabel" TEXT NOT NULL,
  "percent" INTEGER,
  "quantity" INTEGER,
  CONSTRAINT "PurchaseOrderSizeAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrderSizeAllocation_orderId_sizeLabel_key" UNIQUE ("orderId", "sizeLabel")
);

CREATE TABLE "PurchaseOrderColorAllocation" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "colorName" TEXT NOT NULL,
  "hexCode" TEXT,
  "percent" INTEGER,
  "quantity" INTEGER,
  CONSTRAINT "PurchaseOrderColorAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrderColorAllocation_orderId_colorName_key" UNIQUE ("orderId", "colorName")
);

CREATE TABLE "ProductionPlan" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "lineId" TEXT NOT NULL,
  "startDate" TIMESTAMP NOT NULL,
  "endDate" TIMESTAMP NOT NULL,
  "plannedQty" INTEGER NOT NULL,
  "dailyTarget" INTEGER,
  "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductionPlan_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StageDailyMetric" (
  "id" TEXT PRIMARY KEY,
  "metricDate" TIMESTAMP NOT NULL,
  "stage" "ProductionStageCode" NOT NULL,
  "plannedQty" INTEGER NOT NULL,
  "actualQty" INTEGER NOT NULL,
  "wipQty" INTEGER NOT NULL,
  "rejectedQty" INTEGER NOT NULL,
  "pendingQty" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StageDailyMetric_metricDate_stage_key" UNIQUE ("metricDate", "stage")
);

CREATE TABLE "LineDailyMetric" (
  "id" TEXT PRIMARY KEY,
  "metricDate" TIMESTAMP NOT NULL,
  "lineId" TEXT NOT NULL,
  "efficiencyPct" INTEGER NOT NULL,
  "outputQty" INTEGER NOT NULL,
  "isRunning" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineDailyMetric_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LineDailyMetric_metricDate_lineId_key" UNIQUE ("metricDate", "lineId")
);

CREATE TABLE "VendorChallan" (
  "id" TEXT PRIMARY KEY,
  "challanNumber" TEXT NOT NULL UNIQUE,
  "vendorId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "process" TEXT NOT NULL,
  "challanDate" TIMESTAMP NOT NULL,
  "outwardQty" INTEGER NOT NULL,
  "inwardQty" INTEGER NOT NULL DEFAULT 0,
  "rejectedQty" INTEGER NOT NULL DEFAULT 0,
  "status" "ChallanStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorChallan_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VendorChallan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QaDefectType" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "QaInspection" (
  "id" TEXT PRIMARY KEY,
  "inspectedAt" TIMESTAMP NOT NULL,
  "orderId" TEXT,
  "vendorId" TEXT,
  "lineId" TEXT,
  "stage" "ProductionStageCode" NOT NULL,
  "checkedQty" INTEGER NOT NULL,
  "approvedQty" INTEGER NOT NULL,
  "rejectedQty" INTEGER NOT NULL,
  "reworkQty" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QaInspection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "QaInspection_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "QaInspection_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ProductionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "QaInspectionDefect" (
  "id" TEXT PRIMARY KEY,
  "inspectionId" TEXT NOT NULL,
  "defectTypeId" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  CONSTRAINT "QaInspectionDefect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QaInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QaInspectionDefect_defectTypeId_fkey" FOREIGN KEY ("defectTypeId") REFERENCES "QaDefectType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QaInspectionDefect_inspectionId_defectTypeId_key" UNIQUE ("inspectionId", "defectTypeId")
);

CREATE TABLE "VendorWeeklyMetric" (
  "id" TEXT PRIMARY KEY,
  "vendorId" TEXT NOT NULL,
  "weekStartDate" TIMESTAMP NOT NULL,
  "onTimePct" INTEGER NOT NULL,
  "throughputQty" INTEGER NOT NULL,
  "qualityPct" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorWeeklyMetric_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VendorWeeklyMetric_vendorId_weekStartDate_key" UNIQUE ("vendorId", "weekStartDate")
);

CREATE TABLE "DispatchShipment" (
  "id" TEXT PRIMARY KEY,
  "shipmentNumber" TEXT NOT NULL UNIQUE,
  "orderId" TEXT NOT NULL,
  "dispatchDate" TIMESTAMP NOT NULL,
  "quantity" INTEGER NOT NULL,
  "invoiceNumber" TEXT,
  "status" "DispatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DispatchShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "occurredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "targetLabel" TEXT NOT NULL,
  CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Alert" (
  "id" TEXT PRIMARY KEY,
  "severity" "AlertSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "orderId" TEXT,
  "vendorId" TEXT,
  "materialId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP,
  CONSTRAINT "Alert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Alert_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Alert_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

