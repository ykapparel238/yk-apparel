CREATE OR REPLACE VIEW "daily_order_status_snapshot" AS
SELECT
  CURRENT_DATE AS "snapshotDate",
  "brandId",
  "styleId",
  "seasonCode",
  "status",
  COUNT(*)::int AS "orderCount",
  SUM("quantity")::int AS "orderQty",
  SUM("deliveredQty")::int AS "deliveredQty"
FROM "PurchaseOrder"
GROUP BY "brandId", "styleId", "seasonCode", "status";

CREATE OR REPLACE VIEW "daily_production_stage_fact" AS
SELECT
  DATE("metricDate") AS "metricDate",
  "stage",
  SUM("plannedQty")::int AS "plannedQty",
  SUM("actualQty")::int AS "actualQty",
  SUM("wipQty")::int AS "wipQty",
  SUM("rejectedQty")::int AS "rejectedQty",
  SUM("pendingQty")::int AS "pendingQty"
FROM "StageDailyMetric"
GROUP BY DATE("metricDate"), "stage";

CREATE OR REPLACE VIEW "daily_line_performance_fact" AS
SELECT
  DATE(ldm."metricDate") AS "metricDate",
  ldm."lineId",
  AVG(ldm."efficiencyPct")::int AS "efficiencyPct",
  SUM(ldm."outputQty")::int AS "outputQty",
  BOOL_OR(ldm."isRunning") AS "isRunning"
FROM "LineDailyMetric" ldm
GROUP BY DATE(ldm."metricDate"), ldm."lineId";

CREATE OR REPLACE VIEW "daily_vendor_performance_fact" AS
SELECT
  DATE("weekStartDate") AS "metricDate",
  "vendorId",
  AVG("onTimePct")::int AS "onTimePct",
  AVG("qualityPct")::int AS "qualityPct",
  SUM("throughputQty")::int AS "throughputQty"
FROM "VendorWeeklyMetric"
GROUP BY DATE("weekStartDate"), "vendorId";

CREATE OR REPLACE VIEW "daily_inventory_balance_fact" AS
SELECT
  CURRENT_DATE AS "metricDate",
  "id" AS "materialId",
  "stockQty",
  "allocatedQty",
  ("stockQty" - "allocatedQty") AS "freeQty",
  "reorderLevel"
FROM "Material";

CREATE OR REPLACE VIEW "daily_qa_fact" AS
SELECT
  DATE("inspectedAt") AS "metricDate",
  "stage",
  COALESCE("vendorId", '') AS "vendorId",
  COALESCE("lineId", '') AS "lineId",
  SUM("checkedQty")::int AS "checkedQty",
  SUM("approvedQty")::int AS "approvedQty",
  SUM("rejectedQty")::int AS "rejectedQty",
  SUM("reworkQty")::int AS "reworkQty"
FROM "QaInspection"
GROUP BY DATE("inspectedAt"), "stage", COALESCE("vendorId", ''), COALESCE("lineId", '');

CREATE OR REPLACE VIEW "dispatch_otif_fact" AS
SELECT
  DATE(ds."dispatchDate") AS "metricDate",
  ds."orderId",
  ds."status",
  ds."quantity",
  po."dueDate",
  CASE WHEN DATE(ds."dispatchDate") <= DATE(po."dueDate") THEN TRUE ELSE FALSE END AS "onTime"
FROM "DispatchShipment" ds
JOIN "PurchaseOrder" po ON po."id" = ds."orderId";
