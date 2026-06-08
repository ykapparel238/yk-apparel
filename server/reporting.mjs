import { prisma } from "./db.mjs";
import { buildMrpItems } from "./routes/mrp.mjs";
import { ACTIVE_ORDER_STATUSES, formatEnumLabel } from "./constants.mjs";

function toDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function stringifyCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/"/g, "\"\"");
}

export function toCsv(rows) {
  if (!rows.length) return "No data\n";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => `"${stringifyCell(row[header])}"`).join(",")),
  ];
  return lines.join("\n");
}

function escapePdfText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdfLines(title, rows) {
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const widths = headers.reduce((map, header) => {
    const longest = rows.slice(0, 50).reduce((max, row) => {
      const cell = String(row[header] ?? "");
      return Math.max(max, cell.length);
    }, header.length);
    map[header] = Math.min(Math.max(longest, header.length), 18);
    return map;
  }, {});

  const formatRow = (row) => headers
    .map((header) => String(row[header] ?? "").slice(0, widths[header]).padEnd(widths[header], " "))
    .join(" | ")
    .trimEnd();

  const divider = headers.map((header) => "-".repeat(widths[header])).join("-+-");

  return [
    title,
    "",
    headers.length ? formatRow(Object.fromEntries(headers.map((header) => [header, header]))) : "No data",
    headers.length ? divider : "",
    ...rows.map((row) => formatRow(row)),
  ].filter(Boolean);
}

export function toPdfBuffer(title, rows) {
  const allLines = buildPdfLines(title, rows);
  const linesPerPage = 42;
  const pages = [];
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    pages.push(allLines.slice(i, i + linesPerPage));
  }
  if (!pages.length) {
    pages.push([title, "", "No data"]);
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("<< /Type /Pages /Count 0 /Kids [] >>");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  const pageIds = [];
  pages.forEach((pageLines) => {
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      ...pageLines.flatMap((line, index) => {
        const prefix = index === 0 ? [] : ["0 -16 Td"];
        return [...prefix, `(${escapePdfText(line)}) Tj`];
      }),
      "ET",
    ].join("\n");

    const contentId = addObject(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "binary");
}

const WASTAGE_FACTORS = {
  YARN: { process: "Knitting + Washing", pct: 9 },
  TRIM: { process: "Cutting + Stitching", pct: 3 },
  LABEL: { process: "Packing", pct: 2 },
  PACKING: { process: "Packing", pct: 1 },
  OTHER: { process: "General Handling", pct: 4 },
};

export function buildDashboardPayload({ orders, stageMetrics, lineMetrics, defects, alerts, vendors, shipments }) {
  const totalOrders = orders.length;
  const unitsPlanned = orders.reduce((sum, order) => sum + order.quantity, 0);
  const unitsCompleted = orders.reduce((sum, order) => sum + order.deliveredQty, 0);
  const unitsInProduction = orders
    .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
    .reduce((sum, order) => sum + Math.max(0, order.quantity - order.deliveredQty), 0);
  const delayedOrders = orders.filter((order) => order.status === "DELAYED").length;

  const byDay = new Map();
  stageMetrics.slice(-70).forEach((metric) => {
    const key = toDate(metric.metricDate);
    const current = byDay.get(key) ?? { planned: 0, actual: 0, rejected: 0 };
    current.planned += Number(metric.plannedQty);
    current.actual += Number(metric.actualQty);
    current.rejected += Number(metric.rejectedQty);
    byDay.set(key, current);
  });
  const dailyTrend = Array.from(byDay.entries()).slice(-7).map(([date, value]) => ({
    day: new Date(date).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    planned: value.planned,
    actual: value.actual,
    rejected: value.rejected,
  }));

  const qaTotal = defects.reduce((sum, defect) => sum + defect.count, 0);
  const groupedDefects = new Map();
  defects.forEach((defect) => {
    groupedDefects.set(defect.defectType.name, (groupedDefects.get(defect.defectType.name) ?? 0) + defect.count);
  });
  const qaDefects = Array.from(groupedDefects.entries())
    .map(([type, count]) => ({
      type,
      count,
      pct: qaTotal ? Math.round((count / qaTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const monthMap = new Map();
  lineMetrics.forEach((metric) => {
    const month = new Date(metric.metricDate).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const current = monthMap.get(month) ?? { capacity: 200000, used: 0 };
    current.used += Number(metric.outputQty);
    monthMap.set(month, current);
  });
  const monthlyCapacity = Array.from(monthMap.entries()).map(([month, value]) => ({
    month,
    capacity: value.capacity,
    used: value.used,
  }));

  const brandMap = new Map();
  orders.forEach((order) => {
    brandMap.set(order.brand.name, (brandMap.get(order.brand.name) ?? 0) + order.quantity);
  });
  const brandSummary = Array.from(brandMap.entries()).map(([brand, units]) => ({ brand, units }));

  const latestStageDate = stageMetrics.length ? toDate(stageMetrics[stageMetrics.length - 1].metricDate) : null;
  const productionStages = latestStageDate
    ? stageMetrics
        .filter((metric) => toDate(metric.metricDate) === latestStageDate)
        .map((metric) => ({
          stage: formatEnumLabel(metric.stage),
          planned: Number(metric.plannedQty),
          actual: Number(metric.actualQty),
          wip: Number(metric.wipQty),
          rejected: Number(metric.rejectedQty),
        }))
    : [];

  const lineEfficiency = lineMetrics.length
    ? Math.round(lineMetrics.reduce((sum, metric) => sum + Number(metric.efficiencyPct), 0) / lineMetrics.length)
    : 0;
  const onTimeCount = shipments.filter((shipment) => shipment.dispatchDate <= shipment.order.dueDate).length;
  const otif = shipments.length ? Math.round((onTimeCount / shipments.length) * 100) : 0;
  const totalRejected = stageMetrics.reduce((sum, metric) => sum + Number(metric.rejectedQty), 0);
  const totalChecked = stageMetrics.reduce((sum, metric) => sum + Number(metric.actualQty), 0);
  const rejectionPct = totalChecked ? Number(((totalRejected / totalChecked) * 100).toFixed(1)) : 0;

  return {
    kpis: {
      totalOrders,
      unitsPlanned,
      unitsInProduction,
      unitsCompleted,
      lineEfficiency,
      otif,
      rejectionPct,
      delayedOrders,
    },
    dailyTrend,
    qaDefects,
    monthlyCapacity,
    brandSummary,
    productionStages,
    alerts: alerts.map((alert) => ({
      id: alert.id,
      severity: alert.severity.toLowerCase(),
      title: alert.title,
      time: alert.createdAt.toISOString().slice(0, 16).replace("T", " "),
      module: alert.module,
    })),
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      process: vendor.process,
      pending: vendor.challans.reduce((sum, challan) => sum + Math.max(0, challan.outwardQty - challan.inwardQty), 0),
      otd: vendor.weeklyMetrics.length ? Math.round(vendor.weeklyMetrics.reduce((sum, metric) => sum + metric.onTimePct, 0) / vendor.weeklyMetrics.length) : 0,
      quality: vendor.weeklyMetrics.length ? Math.round(vendor.weeklyMetrics.reduce((sum, metric) => sum + metric.qualityPct, 0) / vendor.weeklyMetrics.length) : 0,
    })),
    orders: orders.slice(0, 7).map((order) => ({
      id: order.poNumber,
      brand: order.brand.name,
      qty: order.quantity,
      status: formatEnumLabel(order.status),
    })),
  };
}

export async function getDashboardPayload() {
  const [orders, stageMetrics, lineMetrics, defects, alerts, vendors, shipments] = await Promise.all([
    prisma.purchaseOrder.findMany({
      include: { brand: true, style: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.$queryRawUnsafe(`
      SELECT "metricDate", "stage", "plannedQty", "actualQty", "wipQty", "rejectedQty", "pendingQty"
      FROM "daily_production_stage_fact"
      ORDER BY "metricDate" ASC, "stage" ASC
    `),
    prisma.$queryRawUnsafe(`
      SELECT "metricDate", "lineId", "efficiencyPct", "outputQty", "isRunning"
      FROM "daily_line_performance_fact"
      ORDER BY "metricDate" ASC, "lineId" ASC
    `),
    prisma.qaInspectionDefect.findMany({ include: { defectType: true } }),
    prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.vendor.findMany({ include: { challans: true, weeklyMetrics: true } }),
    prisma.dispatchShipment.findMany({ include: { order: true } }),
  ]);

  return buildDashboardPayload({ orders, stageMetrics, lineMetrics, defects, alerts, vendors, shipments });
}

async function getProductionRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT "metricDate", "stage", "plannedQty", "actualQty", "wipQty", "rejectedQty", "pendingQty"
    FROM "daily_production_stage_fact"
    ORDER BY "metricDate" DESC, "stage" ASC
    LIMIT 120
  `);
  return rows.map((row) => ({
    metricDate: toDate(row.metricDate),
    stage: formatEnumLabel(row.stage),
    plannedQty: Number(row.plannedQty),
    actualQty: Number(row.actualQty),
    wipQty: Number(row.wipQty),
    rejectedQty: Number(row.rejectedQty),
    pendingQty: Number(row.pendingQty),
  }));
}

async function getOrderStatusRows() {
  const rows = await prisma.purchaseOrder.findMany({
    include: { brand: true, style: true },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((row) => ({
    poNumber: row.poNumber,
    brand: row.brand.name,
    style: row.style.code,
    season: row.seasonCode,
    quantity: row.quantity,
    deliveredQty: row.deliveredQty,
    dueDate: toDate(row.dueDate),
    status: formatEnumLabel(row.status),
    priority: formatEnumLabel(row.priority),
  }));
}

async function getLinePerformanceRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT dlp."metricDate", pl."code", pl."name", dlp."efficiencyPct", dlp."outputQty", dlp."isRunning"
    FROM "daily_line_performance_fact" dlp
    JOIN "ProductionLine" pl ON pl."id" = dlp."lineId"
    ORDER BY dlp."metricDate" DESC, pl."name" ASC
    LIMIT 120
  `);
  return rows.map((row) => ({
    metricDate: toDate(row.metricDate),
    lineCode: row.code,
    lineName: row.name,
    efficiencyPct: Number(row.efficiencyPct),
    outputQty: Number(row.outputQty),
    isRunning: Boolean(row.isRunning),
  }));
}

async function getVendorPerformanceRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT dvpf."metricDate", v."code", v."name", v."process", dvpf."onTimePct", dvpf."qualityPct", dvpf."throughputQty"
    FROM "daily_vendor_performance_fact" dvpf
    JOIN "Vendor" v ON v."id" = dvpf."vendorId"
    ORDER BY dvpf."metricDate" DESC, v."name" ASC
    LIMIT 120
  `);
  return rows.map((row) => ({
    metricDate: toDate(row.metricDate),
    vendorCode: row.code,
    vendorName: row.name,
    process: row.process,
    onTimePct: Number(row.onTimePct),
    qualityPct: Number(row.qualityPct),
    throughputQty: Number(row.throughputQty),
  }));
}

async function getStockRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT dibf."metricDate", m."sku", m."name", m."uom", s."name" AS "supplierName",
           dibf."stockQty", dibf."allocatedQty", dibf."freeQty", dibf."reorderLevel"
    FROM "daily_inventory_balance_fact" dibf
    JOIN "Material" m ON m."id" = dibf."materialId"
    LEFT JOIN "Supplier" s ON s."id" = m."supplierId"
    ORDER BY m."sku" ASC
  `);
  return rows.map((row) => ({
    metricDate: toDate(row.metricDate),
    sku: row.sku,
    material: row.name,
    supplier: row.supplierName ?? "Unassigned",
    uom: row.uom,
    stockQty: Number(row.stockQty),
    allocatedQty: Number(row.allocatedQty),
    freeQty: Number(row.freeQty),
    reorderLevel: Number(row.reorderLevel),
  }));
}

async function getRejectionRows() {
  const rows = await prisma.qaInspectionDefect.findMany({
    include: {
      defectType: true,
      inspection: {
        include: {
          vendor: true,
          order: true,
        },
      },
    },
    orderBy: { inspection: { inspectedAt: "desc" } },
    take: 200,
  });
  return rows.map((row) => ({
    inspectedAt: toDate(row.inspection.inspectedAt),
    defectType: row.defectType.name,
    count: row.count,
    orderPo: row.inspection.order?.poNumber ?? "",
    vendor: row.inspection.vendor?.name ?? "",
    stage: formatEnumLabel(row.inspection.stage),
  }));
}

async function getDispatchRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT dof."metricDate", ds."shipmentNumber", po."poNumber", b."name" AS "brandName",
           dof."status", dof."quantity", dof."dueDate", dof."onTime"
    FROM "dispatch_otif_fact" dof
    JOIN "DispatchShipment" ds ON ds."orderId" = dof."orderId" AND DATE(ds."dispatchDate") = dof."metricDate" AND ds."quantity" = dof."quantity"
    JOIN "PurchaseOrder" po ON po."id" = dof."orderId"
    JOIN "Brand" b ON b."id" = po."brandId"
    ORDER BY dof."metricDate" DESC, ds."shipmentNumber" DESC
    LIMIT 200
  `);
  return rows.map((row) => ({
    metricDate: toDate(row.metricDate),
    shipmentNumber: row.shipmentNumber,
    poNumber: row.poNumber,
    brand: row.brandName,
    status: formatEnumLabel(row.status),
    quantity: Number(row.quantity),
    dueDate: toDate(row.dueDate),
    onTime: Boolean(row.onTime),
  }));
}

async function getManagementSummaryRows() {
  const [orders, shipments, materials, vendors, inspections] = await Promise.all([
    prisma.purchaseOrder.findMany(),
    prisma.dispatchShipment.findMany({ include: { order: true } }),
    prisma.material.findMany(),
    prisma.vendorWeeklyMetric.findMany(),
    prisma.qaInspection.findMany(),
  ]);

  const totalOrders = orders.length;
  const unitsPlanned = orders.reduce((sum, row) => sum + row.quantity, 0);
  const unitsDelivered = orders.reduce((sum, row) => sum + row.deliveredQty, 0);
  const activeOrders = orders.filter((row) => ACTIVE_ORDER_STATUSES.includes(row.status)).length;
  const onTimeShipments = shipments.filter((shipment) => shipment.dispatchDate <= shipment.order.dueDate).length;
  const otifPct = shipments.length ? Math.round((onTimeShipments / shipments.length) * 100) : 0;
  const freeStock = materials.reduce((sum, material) => sum + Math.max(0, Number(material.stockQty) - Number(material.allocatedQty)), 0);
  const avgVendorQuality = vendors.length ? Math.round(vendors.reduce((sum, row) => sum + row.qualityPct, 0) / vendors.length) : 0;
  const qaPassRate = inspections.length
    ? Math.round(inspections.reduce((sum, row) => sum + Math.round((row.approvedQty / Math.max(1, row.checkedQty)) * 100), 0) / inspections.length)
    : 0;

  return [{
    totalOrders,
    activeOrders,
    unitsPlanned,
    unitsDelivered,
    otifPct,
    freeStock,
    avgVendorQuality,
    qaPassRate,
  }];
}

async function getMrpRows() {
  const [bomItems, materials, orders] = await Promise.all([
    prisma.billOfMaterialItem.findMany({
      include: {
        material: { include: { supplier: true } },
        style: true,
      },
    }),
    prisma.material.findMany({
      include: { supplier: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
    }),
  ]);
  return buildMrpItems(bomItems, materials, orders);
}

async function getProcurementRows() {
  const rows = await prisma.supplierPurchaseOrder.findMany({
    include: {
      supplier: true,
      procurementRequest: true,
      lines: {
        include: { material: true },
      },
      receipts: true,
    },
    orderBy: { orderDate: "desc" },
  });
  return rows.map((row) => ({
    poNumber: row.poNumber,
    supplier: row.supplier.name,
    material: row.lines[0]?.material.name ?? "",
    sku: row.lines[0]?.material.sku ?? "",
    requestedQty: Number(row.lines[0]?.requestedQty ?? 0),
    orderedQty: Number(row.lines[0]?.orderedQty ?? 0),
    receivedQty: Number(row.lines[0]?.receivedQty ?? 0),
    status: formatEnumLabel(row.status),
    expectedDate: toDate(row.expectedDate),
    receipts: row.receipts.length,
  }));
}

async function getProductionEntryRows() {
  const rows = await prisma.productionEntry.findMany({
    include: {
      line: true,
      order: true,
      shift: true,
      downtimeReason: true,
    },
    orderBy: [{ metricDate: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return rows.map((row) => ({
    metricDate: toDate(row.metricDate),
    line: row.line.name,
    orderPo: row.order?.poNumber ?? "",
    shift: row.shift?.name ?? "",
    stage: formatEnumLabel(row.stage),
    plannedQty: row.plannedQty,
    actualQty: row.actualQty,
    rejectedQty: row.rejectedQty,
    downtimeMinutes: row.downtimeMinutes,
    downtimeReason: row.downtimeReason?.label ?? "",
  }));
}

async function getCapaRows() {
  const rows = await prisma.correctiveAction.findMany({
    include: {
      vendor: true,
      order: true,
      line: true,
      inspection: true,
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => ({
    title: row.title,
    vendor: row.vendor?.name ?? "",
    orderPo: row.order?.poNumber ?? "",
    line: row.line?.name ?? "",
    ownerName: row.ownerName,
    dueDate: toDate(row.dueDate),
    status: formatEnumLabel(row.status),
    inspectionDate: row.inspection ? toDate(row.inspection.inspectedAt) : "",
  }));
}

async function getStyleTechPackRows() {
  const [styles, assets] = await Promise.all([
    prisma.style.findMany({
      include: {
        brand: true,
        sizes: { orderBy: { sortOrder: "asc" } },
        colors: { orderBy: { sortOrder: "asc" } },
        samples: { orderBy: { createdAt: "desc" } },
        measurementSpecs: true,
        threadSpecs: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.fileAsset.findMany({
      where: { entityType: "STYLE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const assetCountByStyle = assets.reduce((map, asset) => {
    map.set(asset.entityId, (map.get(asset.entityId) ?? 0) + 1);
    return map;
  }, new Map());

  return styles.map((style) => ({
    brand: style.brand.name,
    styleCode: style.code,
    styleName: style.name,
    gauge: style.gauge,
    yarn: style.yarnDescription,
    sizeCount: style.sizes.length,
    colorwayCount: style.colors.length,
    sampleCount: style.samples.length,
    latestSampleStatus: style.samples[0] ? formatEnumLabel(style.samples[0].status) : "Not Started",
    measurementCount: style.measurementSpecs.length,
    threadSpecCount: style.threadSpecs.length,
    assetCount: assetCountByStyle.get(style.id) ?? 0,
  }));
}

async function getForecastRows() {
  const [bomItems, materials, orders, procurementRequests] = await Promise.all([
    prisma.billOfMaterialItem.findMany({
      include: {
        material: { include: { supplier: true } },
      },
    }),
    prisma.material.findMany({
      include: { supplier: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
    }),
    prisma.procurementRequest.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
  ]);

  const procurementMap = new Map(procurementRequests.map((item) => [item.materialId, item]));

  return buildMrpItems(bomItems, materials, orders).map((item) => {
    const material = materials.find((entry) => entry.id === item.materialId);
    const factors = WASTAGE_FACTORS[material?.type ?? "OTHER"] ?? WASTAGE_FACTORS.OTHER;
    const riskBufferPct = item.shortage > 0 ? 5 : item.free < item.required * 0.15 ? 3 : 1;
    const wastagePct = factors.pct;
    const adjustedRequired = Math.round(item.required * (1 + (wastagePct + riskBufferPct) / 100) * 100) / 100;
    const forecastShortage = Math.max(0, Math.round((adjustedRequired - item.free) * 100) / 100);
    const riskLevel = forecastShortage > item.required * 0.2 ? "High" : forecastShortage > 0 ? "Medium" : "Low";
    const request = procurementMap.get(item.materialId);

    return {
      sku: item.sku,
      material: item.material,
      supplier: item.supplier,
      processLossArea: factors.process,
      baseRequired: item.required,
      wastagePct,
      riskBufferPct,
      adjustedRequired,
      freeStock: item.free,
      forecastShortage,
      riskLevel,
      procurementStatus: request ? formatEnumLabel(request.status) : "Not Raised",
    };
  });
}

async function getRiskRows() {
  const [orders, challans, bomItems, materials] = await Promise.all([
    prisma.purchaseOrder.findMany({
      include: {
        brand: true,
        style: true,
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.vendorChallan.findMany(),
    prisma.billOfMaterialItem.findMany(),
    prisma.material.findMany(),
  ]);

  const freeByMaterial = new Map(
    materials.map((material) => [material.id, Math.max(0, Number(material.stockQty) - Number(material.allocatedQty))]),
  );
  const challanPendingByOrder = new Map();
  challans.forEach((challan) => {
    challanPendingByOrder.set(
      challan.orderId,
      (challanPendingByOrder.get(challan.orderId) ?? 0) + Math.max(0, challan.outwardQty - challan.inwardQty),
    );
  });
  const bomByStyle = new Map();
  bomItems.forEach((item) => {
    const list = bomByStyle.get(item.styleId) ?? [];
    list.push(item);
    bomByStyle.set(item.styleId, list);
  });

  return orders.map((order) => {
    const dueAt = new Date(order.dueDate);
    const daysToDue = Math.ceil((dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const progressPct = order.quantity ? Math.round((order.deliveredQty / order.quantity) * 100) : 0;
    const bom = bomByStyle.get(order.styleId) ?? [];
    const shortageMaterials = bom.filter((item) => {
      const free = freeByMaterial.get(item.materialId) ?? 0;
      const required = Number(item.quantityPerPiece) * Math.max(0, order.quantity - order.deliveredQty);
      return required > free;
    }).length;
    const vendorPending = challanPendingByOrder.get(order.id) ?? 0;
    let riskScore = 0;
    if (daysToDue < 0) riskScore += 45;
    else if (daysToDue <= 7) riskScore += 30;
    else if (daysToDue <= 14) riskScore += 15;
    riskScore += Math.min(25, shortageMaterials * 8);
    if (progressPct < 50) riskScore += 15;
    if (vendorPending > order.quantity * 0.2) riskScore += 15;

    const riskLevel = riskScore >= 60 ? "High" : riskScore >= 35 ? "Medium" : "Low";
    const primaryDriver = daysToDue < 0
      ? "Overdue due date"
      : shortageMaterials
        ? "Material shortage exposure"
        : vendorPending > order.quantity * 0.2
          ? "Vendor return pending"
          : progressPct < 50
            ? "Low completion progress"
            : "Stable";

    return {
      poNumber: order.poNumber,
      brand: order.brand.name,
      style: order.style.code,
      dueDate: toDate(order.dueDate),
      progressPct,
      shortageMaterials,
      vendorPendingQty: vendorPending,
      daysToDue,
      riskScore,
      riskLevel,
      primaryDriver,
    };
  });
}

export const reportCatalog = [
  {
    slug: "daily-production-report",
    name: "Daily Production Report",
    desc: "Stage-wise output, efficiency, rejection by line",
    category: "Production",
    rows: getProductionRows,
  },
  {
    slug: "order-status-report",
    name: "Order Status Report",
    desc: "PO lifecycle, delays, dispatch readiness",
    category: "Merchandising",
    rows: getOrderStatusRows,
  },
  {
    slug: "line-performance-report",
    name: "Line Performance",
    desc: "Efficiency, output, downtime per knitting line",
    category: "Production",
    rows: getLinePerformanceRows,
  },
  {
    slug: "vendor-performance-scorecard",
    name: "Vendor Performance Scorecard",
    desc: "OTD, quality, capacity utilization",
    category: "Vendor",
    rows: getVendorPerformanceRows,
  },
  {
    slug: "stock-report",
    name: "Stock Report",
    desc: "Yarn, trims, packing — current and aged inventory",
    category: "Stores",
    rows: getStockRows,
  },
  {
    slug: "rejection-rework-report",
    name: "Rejection & Rework Report",
    desc: "Defect analysis, root cause, vendor breakdown",
    category: "QA",
    rows: getRejectionRows,
  },
  {
    slug: "dispatch-report",
    name: "Dispatch Report",
    desc: "Shipment status, OTIF, brand-wise delivery",
    category: "Logistics",
    rows: getDispatchRows,
  },
  {
    slug: "management-summary",
    name: "Management Summary",
    desc: "Executive KPIs across all departments",
    category: "Executive",
    rows: getManagementSummaryRows,
  },
  {
    slug: "material-requirement-planning",
    name: "Material Requirement Planning",
    desc: "Required vs free stock and shortages by material",
    category: "Planning",
    rows: getMrpRows,
  },
  {
    slug: "procurement-status-report",
    name: "Procurement Status Report",
    desc: "Supplier PO issue and receipt progress by material shortage action",
    category: "Stores",
    rows: getProcurementRows,
  },
  {
    slug: "production-actuals-report",
    name: "Production Actuals Report",
    desc: "Shift-level actual vs plan, rejection, and downtime detail",
    category: "Production",
    rows: getProductionEntryRows,
  },
  {
    slug: "capa-closure-report",
    name: "CAPA Closure Report",
    desc: "Corrective actions, owners, due dates, and closure status",
    category: "QA",
    rows: getCapaRows,
  },
  {
    slug: "style-tech-pack-register",
    name: "Style Tech Pack Register",
    desc: "Style readiness across assets, samples, measurements, and thread specs",
    category: "Masters",
    rows: getStyleTechPackRows,
  },
  {
    slug: "forecast-and-wastage-model",
    name: "Forecast & Wastage Model",
    desc: "Risk-adjusted material requirement with process wastage assumptions",
    category: "Planning",
    rows: getForecastRows,
  },
  {
    slug: "order-risk-watchlist",
    name: "Order Risk Watchlist",
    desc: "Due-date, shortage, vendor, and progress-driven risk view",
    category: "Executive",
    rows: getRiskRows,
  },
];

export async function getReportSummaries() {
  const items = await Promise.all(
    reportCatalog.map(async (report) => {
      const rows = await report.rows();
      return {
        slug: report.slug,
        name: report.name,
        desc: report.desc,
        category: report.category,
        rows: rows.length,
        downloadUrl: `/api/reports/${report.slug}.csv`,
        pdfUrl: `/api/reports/${report.slug}.pdf`,
      };
    }),
  );
  return { items };
}

export async function getReportRows(slug) {
  const report = reportCatalog.find((item) => item.slug === slug);
  if (!report) return null;
  const rows = await report.rows();
  return {
    report,
    rows,
  };
}
