import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { ApiError, asyncHandler, fail, ok } from "../http.mjs";
import { writeAuditLog } from "../audit.mjs";
import { buildMrpItems } from "./mrp.mjs";
import { ACTIVE_ORDER_STATUSES } from "../constants.mjs";
import {
  buildDefaultColorAllocations,
  buildDefaultSizeAllocations,
  normaliseOrderInput,
  validateAllocationTotal,
} from "./orders.mjs";
import { calculateDailyTarget, toUtcDate } from "./planning.mjs";

const router = Router();

const DESKTOP_MIN_VERSION = "1.0.0";
const CHECKPOINT_TTL_DAYS = 30;

const mutationSchema = z.object({
  mutationId: z.string().min(1),
  bundleId: z.string().min(1),
  deviceId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  operationType: z.string().min(1),
  payload: z.unknown(),
  baseVersion: z.string().nullish(),
  createdAt: z.string().min(1),
});

const bundleSchema = z.object({
  bundleId: z.string().min(1),
  deviceId: z.string().min(1),
  workspaceId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  operationType: z.string().min(1),
  createdAt: z.string().min(1),
  mutations: z.array(mutationSchema).min(1),
});

const pushSchema = z.object({
  bundles: z.array(bundleSchema).min(1),
});

const orderPayloadSchema = z.object({
  brandId: z.string().min(1),
  styleId: z.string().min(1),
  poNumber: z.string().min(3),
  seasonCode: z.string().min(2),
  quantity: z.coerce.number().int().positive(),
  dueDate: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  notes: z.string().optional(),
  sizeAllocations: z.array(z.object({ sizeLabel: z.string().min(1), percent: z.coerce.number().int() })).optional(),
  colorAllocations: z.array(z.object({ colorName: z.string().min(1), hexCode: z.string().optional().nullable(), percent: z.coerce.number().int() })).optional(),
});

const planPayloadSchema = z.object({
  orderId: z.string().min(1),
  lineId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  plannedQty: z.coerce.number().int().positive(),
});

const inventoryAdjustmentSchema = z.object({
  sku: z.string().min(1),
  deltaQty: z.coerce.number(),
  reason: z.string().min(2),
});

const procurementCreateSchema = z.object({
  materialId: z.string().min(1),
  requestedQty: z.coerce.number().positive(),
  note: z.string().min(2),
});

const procurementUpdateSchema = z.object({
  requestedQty: z.coerce.number().positive().optional(),
  note: z.string().min(2).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

const qaPayloadSchema = z.object({
  inspectedAt: z.string().min(1),
  orderId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  lineId: z.string().nullable().optional(),
  stage: z.enum(["YARN_INWARD", "KNITTING", "LINKING", "WASHING", "DRYING", "FINISHING", "IRONING", "QUALITY_CHECK", "PACKING", "DISPATCH"]),
  checkedQty: z.coerce.number().int().positive(),
  approvedQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
  reworkQty: z.coerce.number().int().min(0),
  defects: z.array(z.object({ defectTypeId: z.string().min(1), count: z.coerce.number().int().positive() })).default([]),
});

const dispatchPayloadSchema = z.object({
  orderId: z.string().min(1).optional(),
  dispatchDate: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  invoiceNumber: z.string().optional(),
  status: z.enum(["READY", "SCHEDULED", "DISPATCHED", "CANCELLED"]).optional(),
});

function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function mapStatus(value) {
  if (value === "QA") return "QA";
  if (value === "IN_PROGRESS") return "In Progress";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function ensureDesktopDevice(deviceId, clientVersion, workspaceId = "default") {
  return prisma.desktopDevice.upsert({
    where: { id: deviceId },
    create: {
      id: deviceId,
      clientVersion,
      workspaceId,
      lastSeenAt: new Date(),
    },
    update: {
      clientVersion,
      workspaceId,
      lastSeenAt: new Date(),
    },
  });
}

function mapDeviceAccessState(status) {
  if (status === "LOCKED" || status === "REVOKED") return "locked";
  if (status === "RESTRICTED") return "restricted";
  return "valid";
}

function getClientVersion(req) {
  return req.headers["x-desktop-client-version"]?.toString() ?? "0.0.0";
}

function getDeviceId(req) {
  return req.headers["x-desktop-device-id"]?.toString() ?? "unknown-device";
}

function ensureCompatibleClient(req, res) {
  const clientVersion = getClientVersion(req);
  if (compareVersions(clientVersion, DESKTOP_MIN_VERSION) < 0) {
    fail(res, 426, "Desktop client is too old for sync", "CLIENT_TOO_OLD", {
      minimumVersion: DESKTOP_MIN_VERSION,
      currentVersion: clientVersion,
    });
    return false;
  }
  return true;
}

function calculateProgress(order) {
  return order.status === "DISPATCHED"
    ? 100
    : Math.min(100, Math.round((order.deliveredQty / Math.max(1, order.quantity)) * 100));
}

function mapOrder(order) {
  return {
    id: order.id,
    poNumber: order.poNumber,
    brandId: order.brandId,
    brand: order.brand.name,
    styleId: order.styleId,
    style: order.style.code,
    styleName: order.style.name,
    season: order.seasonCode,
    qty: order.quantity,
    delivered: order.deliveredQty,
    due: order.dueDate.toISOString().slice(0, 10),
    status: mapStatus(order.status),
    priority: mapStatus(order.priority),
    progress: calculateProgress(order),
    syncState: "synced",
    syncVersion: order.updatedAt.toISOString(),
  };
}

async function buildOrdersSnapshots() {
  const [ordersResult, brandsResult, stylesResult, challansResult, bomItemsResult] = await Promise.all([
    prisma.purchaseOrder.findMany({
      include: { brand: true, style: true, sizeAllocations: true, colorAllocations: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.style.findMany({
      orderBy: { code: "asc" },
      include: {
        sizes: { orderBy: { sortOrder: "asc" } },
        colors: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.vendorChallan.findMany({
      include: { vendor: true, order: true },
      orderBy: { challanDate: "desc" },
    }),
    prisma.billOfMaterialItem.findMany({
      include: { material: { include: { supplier: true } }, style: true },
    }),
  ]);
  const orders = ordersResult ?? [];
  const brands = brandsResult ?? [];
  const styles = stylesResult ?? [];
  const challans = challansResult ?? [];
  const bomItems = bomItemsResult ?? [];

  const detailMap = {};

  orders.forEach((order) => {
    const orderBom = bomItems.filter((item) => item.styleId === order.styleId);
    const orderChallans = challans.filter((item) => item.orderId === order.id);
    detailMap[order.id] = {
      item: mapOrder(order),
      bom: orderBom.map((item) => ({
        id: item.id,
        item: item.material.name,
        type: mapStatus(item.material.type),
        qty: Number(item.quantityPerPiece),
        uom: item.uom,
        supplier: item.material.supplier?.name ?? null,
      })),
      sizes: order.sizeAllocations.map((item) => ({
        size: item.sizeLabel,
        qty: item.percent ?? item.quantity ?? 0,
      })),
      colors: order.colorAllocations.map((item) => ({
        color: item.colorName,
        hex: item.hexCode ?? null,
        qty: item.percent ?? item.quantity ?? 0,
      })),
      challans: orderChallans.map((item) => ({
        id: item.id,
        challanNumber: item.challanNumber,
        date: item.challanDate.toISOString().slice(0, 10),
        vendor: item.vendor.name,
        process: item.process,
        po: item.order.poNumber,
        outQty: item.outwardQty,
        inQty: item.inwardQty,
        rejected: item.rejectedQty,
        status: mapStatus(item.status),
      })),
    };
  });

  return {
    "orders.list": { items: orders.map(mapOrder) },
    "orders.options": {
      brands: brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        code: brand.code,
        country: brand.countryCode,
      })),
      styles: styles.map((style) => ({
        id: style.id,
        code: style.code,
        name: style.name,
        brandId: style.brandId,
        sizes: style.sizes.map((size) => size.label),
        colors: style.colors.map((color) => ({ name: color.name, hexCode: color.hexCode })),
      })),
    },
    "orders.details": detailMap,
  };
}

async function buildPlanningSnapshot() {
  const [latestMetricDate, ordersResult, linesResult, plansResult] = await Promise.all([
    prisma.lineDailyMetric.aggregate({ _max: { metricDate: true } }),
    prisma.purchaseOrder.findMany({ include: { brand: true, style: true }, orderBy: { dueDate: "asc" } }),
    prisma.productionLine.findMany({ orderBy: { name: "asc" } }),
    prisma.productionPlan.findMany({ include: { order: true, line: true } }),
  ]);
  const orders = ordersResult ?? [];
  const lines = linesResult ?? [];
  const plans = plansResult ?? [];

  const latestMetric = latestMetricDate?._max?.metricDate ?? null;
  const lineMetrics = latestMetric
    ? await prisma.lineDailyMetric.findMany({
        where: { metricDate: latestMetric },
        orderBy: { line: { name: "asc" } },
      }) ?? []
    : [];
  const metricMap = new Map(lineMetrics.map((metric) => [metric.lineId, metric]));

  return {
    "planning.board": {
      lines: lines.map((line) => {
        const metric = metricMap.get(line.id);
        return {
          id: line.id,
          name: line.name,
          gauge: line.gauge,
          machines: line.machineCount,
          efficiency: metric?.efficiencyPct ?? 0,
          output: metric?.outputQty ?? 0,
        };
      }),
      orders: orders.map((order) => ({
        id: order.id,
        poNumber: order.poNumber,
        brand: order.brand.name,
        styleName: order.style.name,
        season: order.seasonCode,
        qty: order.quantity,
        due: order.dueDate.toISOString().slice(0, 10),
        status: mapStatus(order.status),
        priority: mapStatus(order.priority),
        progress: calculateProgress(order),
        syncState: "synced",
        syncVersion: order.updatedAt.toISOString(),
      })),
      allocations: plans.map((plan) => ({
        id: plan.id,
        orderId: plan.orderId,
        lineId: plan.lineId,
        poNumber: plan.order.poNumber,
        lineName: plan.line.name,
        plannedQty: plan.plannedQty,
        startDate: plan.startDate.toISOString().slice(0, 10),
        endDate: plan.endDate.toISOString().slice(0, 10),
        status: mapStatus(plan.status),
        syncState: "synced",
        syncVersion: plan.updatedAt.toISOString(),
      })),
    },
  };
}

async function buildInventorySnapshots() {
  const [materialsResult, procurementRequestsResult, bomItemsResult, ordersResult] = await Promise.all([
    prisma.material.findMany({ orderBy: { sku: "asc" }, include: { supplier: true } }),
    prisma.procurementRequest.findMany({
      include: {
        supplier: true,
        material: { include: { supplier: true } },
        createdBy: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.billOfMaterialItem.findMany({
      include: { material: { include: { supplier: true } }, style: true },
    }),
    prisma.purchaseOrder.findMany({ where: { status: { in: ACTIVE_ORDER_STATUSES } } }),
  ]);
  const materials = materialsResult ?? [];
  const procurementRequests = procurementRequestsResult ?? [];
  const bomItems = bomItemsResult ?? [];
  const orders = ordersResult ?? [];

  const mrpItems = buildMrpItems(bomItems, materials, orders);
  const mrpMap = new Map(mrpItems.map((item) => [item.materialId, item]));
  const requestMap = new Map(
    procurementRequests
      .filter((item) => item.status === "OPEN" || item.status === "IN_PROGRESS")
      .map((item) => [item.materialId, item]),
  );

  const mappedRequests = procurementRequests.map((item) => ({
    id: item.id,
    materialId: item.materialId,
    sku: item.material.sku,
    material: item.material.name,
    supplier: item.supplier?.name ?? item.material.supplier?.name ?? "Unassigned",
    shortageQty: Number(item.shortageQty),
    requestedQty: Number(item.requestedQty),
    note: item.note,
    status: mapStatus(item.status),
    createdBy: item.createdBy?.name ?? "System",
    createdAt: item.createdAt.toISOString().slice(0, 10),
    syncState: "synced",
    syncVersion: item.updatedAt.toISOString(),
  }));

  const activeRequestPayload = new Map(mappedRequests.map((item) => [item.materialId, item]));
  const items = materials.map((material) => ({
    id: material.sku,
    materialId: material.id,
    name: material.name,
    type: mapStatus(material.type),
    uom: material.uom,
    stock: Number(material.stockQty),
    min: Number(material.reorderLevel),
    allocated: Number(material.allocatedQty),
    supplier: material.supplier?.name ?? "Unassigned",
    shortage: mrpMap.get(material.id)?.shortage ?? 0,
    activeProcurementRequest: requestMap.has(material.id) ? activeRequestPayload.get(material.id) : null,
    syncState: "synced",
    syncVersion: material.updatedAt.toISOString(),
  }));

  return {
    "inventory.data": {
      items,
      lowStockCount: items.filter((item) => item.stock <= item.min).length,
    },
    "inventory.procurementRequests": {
      items: mappedRequests,
    },
  };
}

async function buildQaSnapshot() {
  const [inspectionsResult, vendorsResult, defectsResult, ordersResult, linesResult, defectTypesResult] = await Promise.all([
    prisma.qaInspection.findMany({
      orderBy: { inspectedAt: "desc" },
      include: {
        order: { select: { id: true, poNumber: true } },
        vendor: { select: { id: true, name: true } },
        line: { select: { id: true, name: true } },
        defects: { include: { defectType: true } },
      },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, include: { weeklyMetrics: true } }),
    prisma.qaInspectionDefect.findMany({ include: { defectType: true } }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      orderBy: { poNumber: "asc" },
      select: { id: true, poNumber: true },
    }),
    prisma.productionLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.qaDefectType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const inspections = inspectionsResult ?? [];
  const vendors = vendorsResult ?? [];
  const defects = defectsResult ?? [];
  const orders = ordersResult ?? [];
  const lines = linesResult ?? [];
  const defectTypes = defectTypesResult ?? [];

  const summary = inspections.reduce((acc, inspection) => {
    acc.checked += inspection.checkedQty;
    acc.approved += inspection.approvedQty;
    acc.rejected += inspection.rejectedQty;
    acc.rework += inspection.reworkQty;
    return acc;
  }, { checked: 0, approved: 0, rejected: 0, rework: 0 });

  const groupedDefects = new Map();
  defects.forEach((defect) => {
    groupedDefects.set(defect.defectType.name, (groupedDefects.get(defect.defectType.name) ?? 0) + defect.count);
  });
  const totalDefects = Array.from(groupedDefects.values()).reduce((sum, count) => sum + count, 0);

  return {
    "qa.data": {
      summary,
      defects: Array.from(groupedDefects.entries()).map(([type, count]) => ({
        type,
        count,
        pct: totalDefects ? Math.round((count / totalDefects) * 100) : 0,
      })).sort((a, b) => b.count - a.count),
      vendors: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        process: vendor.process,
        quality: vendor.weeklyMetrics.length
          ? Math.round(vendor.weeklyMetrics.reduce((sum, metric) => sum + metric.qualityPct, 0) / vendor.weeklyMetrics.length)
          : 0,
      })),
      inspections: inspections.map((inspection) => ({
        id: inspection.id,
        inspectedAt: inspection.inspectedAt.toISOString().slice(0, 10),
        stage: inspection.stage,
        orderId: inspection.orderId ?? null,
        vendorId: inspection.vendorId ?? null,
        lineId: inspection.lineId ?? null,
        orderPo: inspection.order?.poNumber ?? null,
        vendorName: inspection.vendor?.name ?? null,
        lineName: inspection.line?.name ?? null,
        checkedQty: inspection.checkedQty,
        approvedQty: inspection.approvedQty,
        rejectedQty: inspection.rejectedQty,
        reworkQty: inspection.reworkQty,
        defects: inspection.defects.map((defect) => ({
          defectTypeId: defect.defectTypeId,
          defectTypeName: defect.defectType.name,
          count: defect.count,
        })),
        syncState: "synced",
        syncVersion: inspection.updatedAt.toISOString(),
      })),
      orderOptions: orders,
      lineOptions: lines,
      defectTypes,
    },
  };
}

async function buildDispatchSnapshot() {
  const orders = await prisma.purchaseOrder.findMany({
    where: { status: { in: ["QA", "READY_TO_DISPATCH", "DISPATCHED"] } },
    include: {
      brand: true,
      style: true,
      shipments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { dueDate: "asc" },
  }) ?? [];

  return {
    "dispatch.data": {
      items: orders.map((order) => {
        const latestShipment = order.shipments[0] ?? null;
        return {
          id: order.id,
          poNumber: order.poNumber,
          brand: order.brand.name,
          styleName: order.style.name,
          qty: order.quantity,
          dispatched: order.deliveredQty,
          remaining: Math.max(0, order.quantity - order.deliveredQty),
          due: order.dueDate.toISOString().slice(0, 10),
          status: mapStatus(order.status),
          syncState: "synced",
          syncVersion: order.updatedAt.toISOString(),
          latestShipment: latestShipment ? {
            id: latestShipment.id,
            dispatchDate: latestShipment.dispatchDate.toISOString().slice(0, 10),
            quantity: latestShipment.quantity,
            invoiceNumber: latestShipment.invoiceNumber ?? null,
            status: mapStatus(latestShipment.status),
            syncState: "synced",
          } : null,
          shipments: order.shipments.map((shipment) => ({
            id: shipment.id,
            dispatchDate: shipment.dispatchDate.toISOString().slice(0, 10),
            quantity: shipment.quantity,
            invoiceNumber: shipment.invoiceNumber ?? null,
            status: mapStatus(shipment.status),
            syncState: "synced",
          })),
        };
      }),
    },
  };
}

async function buildAllSnapshots() {
  const [orders, planning, inventory, qa, dispatch] = await Promise.all([
    buildOrdersSnapshots(),
    buildPlanningSnapshot(),
    buildInventorySnapshots(),
    buildQaSnapshot(),
    buildDispatchSnapshot(),
  ]);

  return { ...orders, ...planning, ...inventory, ...qa, ...dispatch };
}

async function hasRelevantChanges(cursorAt) {
  const changed = await Promise.all([
    prisma.purchaseOrder.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.purchaseOrderSizeAllocation.findFirst({ where: { order: { updatedAt: { gt: cursorAt } } }, select: { id: true } }),
    prisma.purchaseOrderColorAllocation.findFirst({ where: { order: { updatedAt: { gt: cursorAt } } }, select: { id: true } }),
    prisma.brand.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.style.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.vendorChallan.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.productionPlan.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.productionLine.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.lineDailyMetric.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.material.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.procurementRequest.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.qaInspection.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.qaInspectionDefect.findFirst({ where: { inspection: { updatedAt: { gt: cursorAt } } }, select: { id: true } }),
    prisma.qaDefectType.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.vendor.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.vendorWeeklyMetric.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
    prisma.dispatchShipment.findFirst({ where: { updatedAt: { gt: cursorAt } }, select: { id: true } }),
  ]);

  return changed.some(Boolean);
}

function assertBaseVersion(baseVersion, currentValue, conflictType, localSnapshot, serverSnapshot, summary) {
  if (!baseVersion) return;
  if (baseVersion !== currentValue) {
    const error = new ApiError(409, summary, "SYNC_CONFLICT", {
      conflictType,
      localSnapshot,
      serverSnapshot,
      summary,
    });
    throw error;
  }
}

async function processOrderMutation(tx, req, mutation) {
  if (mutation.operationType === "orders.delete") {
    const existing = await tx.purchaseOrder.findUnique({ where: { id: mutation.entityId }, include: { brand: true, style: true } });
    if (!existing) return { entityId: mutation.entityId };
    assertBaseVersion(mutation.baseVersion, existing.updatedAt.toISOString(), "order_version_conflict", mutation.payload, mapOrder(existing), "Order has changed on the server since the local edit.");
    await tx.purchaseOrder.delete({ where: { id: mutation.entityId } });
    await writeAuditLog(req, {
      tx,
      module: "sync",
      action: "DELETE",
      targetType: "PurchaseOrder",
      targetId: existing.id,
      targetLabel: existing.poNumber,
    });
    return { entityId: existing.id };
  }

  const parsed = orderPayloadSchema.parse(mutation.payload);
  const payload = normaliseOrderInput(parsed);
  const style = await tx.style.findUnique({
    where: { id: payload.styleId },
    include: {
      sizes: { orderBy: { sortOrder: "asc" } },
      colors: { orderBy: { sortOrder: "asc" } },
    },
  });
  const brand = await tx.brand.findUnique({ where: { id: payload.brandId } });
  if (!style || !brand || style.brandId !== payload.brandId) {
    throw new ApiError(400, "Order references are invalid", "INVALID_ORDER_REFERENCES");
  }

  const sizeAllocations = payload.sizeAllocations?.length ? payload.sizeAllocations : buildDefaultSizeAllocations(style.sizes);
  const colorAllocations = payload.colorAllocations?.length ? payload.colorAllocations : buildDefaultColorAllocations(style.colors);
  validateAllocationTotal(sizeAllocations, "Size allocation");
  validateAllocationTotal(colorAllocations, "Color allocation");

  if (mutation.operationType === "orders.create") {
    const duplicate = await tx.purchaseOrder.findUnique({ where: { poNumber: payload.poNumber } });
    if (duplicate) {
      return { entityId: duplicate.id };
    }
    const created = await tx.purchaseOrder.create({
      data: {
        brandId: payload.brandId,
        styleId: payload.styleId,
        poNumber: payload.poNumber,
        seasonCode: payload.seasonCode,
        quantity: payload.quantity,
        dueDate: new Date(payload.dueDate),
        priority: payload.priority,
        notes: payload.notes ?? "",
      },
    });
    await tx.purchaseOrderSizeAllocation.createMany({
      data: sizeAllocations.map((item) => ({
        orderId: created.id,
        sizeLabel: item.sizeLabel,
        percent: item.percent,
      })),
    });
    await tx.purchaseOrderColorAllocation.createMany({
      data: colorAllocations.map((item) => ({
        orderId: created.id,
        colorName: item.colorName,
        hexCode: item.hexCode ?? null,
        percent: item.percent,
      })),
    });
    await writeAuditLog(req, {
      tx,
      module: "sync",
      action: "CREATE",
      targetType: "PurchaseOrder",
      targetId: created.id,
      targetLabel: created.poNumber,
    });
    return { entityId: created.id };
  }

  const existing = await tx.purchaseOrder.findUnique({ where: { id: mutation.entityId }, include: { brand: true, style: true } });
  if (!existing) {
    throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
  }
  assertBaseVersion(mutation.baseVersion, existing.updatedAt.toISOString(), "order_version_conflict", mutation.payload, mapOrder(existing), "Order has changed on the server since the local edit.");

  const updated = await tx.purchaseOrder.update({
    where: { id: existing.id },
    data: {
      brandId: payload.brandId,
      styleId: payload.styleId,
      poNumber: payload.poNumber,
      seasonCode: payload.seasonCode,
      quantity: payload.quantity,
      dueDate: new Date(payload.dueDate),
      priority: payload.priority,
      notes: payload.notes ?? "",
    },
  });
  await tx.purchaseOrderSizeAllocation.deleteMany({ where: { orderId: existing.id } });
  await tx.purchaseOrderColorAllocation.deleteMany({ where: { orderId: existing.id } });
  await tx.purchaseOrderSizeAllocation.createMany({
    data: sizeAllocations.map((item) => ({
      orderId: existing.id,
      sizeLabel: item.sizeLabel,
      percent: item.percent,
    })),
  });
  await tx.purchaseOrderColorAllocation.createMany({
    data: colorAllocations.map((item) => ({
      orderId: existing.id,
      colorName: item.colorName,
      hexCode: item.hexCode ?? null,
      percent: item.percent,
    })),
  });
  await writeAuditLog(req, {
    tx,
    module: "sync",
    action: "UPDATE",
    targetType: "PurchaseOrder",
    targetId: updated.id,
    targetLabel: updated.poNumber,
  });
  return { entityId: updated.id };
}

async function processPlanningMutation(tx, req, mutation) {
  const payload = planPayloadSchema.parse(mutation.payload);
  const startDate = toUtcDate(payload.startDate);
  const endDate = toUtcDate(payload.endDate);
  if (!startDate || !endDate || endDate < startDate) {
    throw new ApiError(400, "Invalid plan window", "INVALID_PLAN_WINDOW");
  }

  const order = await tx.purchaseOrder.findUnique({ where: { id: payload.orderId }, include: { productionPlans: true } });
  const line = await tx.productionLine.findUnique({ where: { id: payload.lineId } });
  if (!order || !line) {
    throw new ApiError(400, "Planning references are invalid", "INVALID_PLAN_REFERENCES");
  }

  if (mutation.operationType === "planning.create") {
    const created = await tx.productionPlan.create({
      data: {
        orderId: payload.orderId,
        lineId: payload.lineId,
        startDate,
        endDate,
        plannedQty: payload.plannedQty,
        dailyTarget: calculateDailyTarget(payload.plannedQty, startDate, endDate),
        status: "ACTIVE",
      },
    });
    if (order.status === "CREATED") {
      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "PLANNED" } });
    }
    await writeAuditLog(req, {
      tx,
      module: "sync",
      action: "CREATE",
      targetType: "ProductionPlan",
      targetId: created.id,
      targetLabel: order.poNumber,
    });
    return { entityId: created.id };
  }

  const existing = await tx.productionPlan.findUnique({
    where: { id: mutation.entityId },
    include: { order: { include: { brand: true, style: true } }, line: true },
  });
  if (!existing) {
    throw new ApiError(404, "Plan not found", "PLAN_NOT_FOUND");
  }
  assertBaseVersion(mutation.baseVersion, existing.updatedAt.toISOString(), "plan_version_conflict", mutation.payload, {
    id: existing.id,
    orderId: existing.orderId,
    lineId: existing.lineId,
    plannedQty: existing.plannedQty,
  }, "Plan changed on the server.");

  const updated = await tx.productionPlan.update({
    where: { id: existing.id },
    data: {
      orderId: payload.orderId,
      lineId: payload.lineId,
      startDate,
      endDate,
      plannedQty: payload.plannedQty,
      dailyTarget: calculateDailyTarget(payload.plannedQty, startDate, endDate),
    },
  });
  await writeAuditLog(req, {
    tx,
    module: "sync",
    action: "UPDATE",
    targetType: "ProductionPlan",
    targetId: updated.id,
    targetLabel: existing.order.poNumber,
  });
  return { entityId: updated.id };
}

async function processInventoryMutation(tx, req, mutation) {
  if (mutation.operationType === "inventory.adjustment.create") {
    const payload = inventoryAdjustmentSchema.parse(mutation.payload);
    const material = await tx.material.findUnique({ where: { sku: payload.sku }, include: { supplier: true } });
    if (!material) throw new ApiError(404, "Material not found", "MATERIAL_NOT_FOUND");
    assertBaseVersion(mutation.baseVersion, material.sku, "inventory_conflict", mutation.payload, {
      sku: material.sku,
      stockQty: Number(material.stockQty),
    }, "Inventory changed before the local adjustment synced.");
    const nextStock = Number(material.stockQty) + payload.deltaQty;
    if (nextStock < 0 || nextStock < Number(material.allocatedQty)) {
      throw new ApiError(409, "Inventory adjustment would create invalid stock balance", "INVALID_STOCK_BALANCE");
    }
    const updated = await tx.material.update({
      where: { id: material.id },
      data: { stockQty: nextStock.toFixed(2) },
    });
    await writeAuditLog(req, {
      tx,
      module: "sync",
      action: "ADJUST",
      targetType: "Material",
      targetId: updated.id,
      targetLabel: material.sku,
    });
    return { entityId: updated.id };
  }

  if (mutation.operationType === "inventory.procurement.create") {
    const payload = procurementCreateSchema.parse(mutation.payload);
    const material = await tx.material.findUnique({ where: { id: payload.materialId }, include: { supplier: true } });
    if (!material) throw new ApiError(404, "Material not found", "MATERIAL_NOT_FOUND");
    const existing = await tx.procurementRequest.findFirst({
      where: { materialId: payload.materialId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    if (existing) return { entityId: existing.id };
    const created = await tx.procurementRequest.create({
      data: {
        materialId: material.id,
        supplierId: material.supplierId ?? null,
        createdByUserId: req.sessionUser?.id ?? null,
        shortageQty: "0.00",
        requestedQty: payload.requestedQty.toFixed(2),
        note: payload.note.trim(),
        status: "OPEN",
      },
    });
    return { entityId: created.id };
  }

  const payload = procurementUpdateSchema.parse(mutation.payload);
  const existing = await tx.procurementRequest.findUnique({ where: { id: mutation.entityId } });
  if (!existing) throw new ApiError(404, "Procurement request not found", "PROCUREMENT_REQUEST_NOT_FOUND");
  assertBaseVersion(mutation.baseVersion, existing.updatedAt.toISOString(), "procurement_version_conflict", mutation.payload, {
    id: existing.id,
    status: existing.status,
  }, "Procurement request changed on the server.");
  const updated = await tx.procurementRequest.update({
    where: { id: existing.id },
    data: {
      requestedQty: payload.requestedQty?.toFixed(2),
      note: payload.note?.trim(),
      status: payload.status,
    },
  });
  return { entityId: updated.id };
}

function validateQaPayload(payload) {
  const defectTotal = payload.defects.reduce((sum, defect) => sum + defect.count, 0);
  if (payload.approvedQty + payload.rejectedQty > payload.checkedQty) {
    throw new ApiError(409, "Approved and rejected quantity cannot exceed checked quantity", "INVALID_QA_TOTALS");
  }
  if (defectTotal > payload.rejectedQty + payload.reworkQty) {
    throw new ApiError(409, "Defect count cannot exceed rejected and rework quantity", "INVALID_DEFECT_TOTALS");
  }
}

async function processQaMutation(tx, req, mutation) {
  const payload = qaPayloadSchema.parse(mutation.payload);
  validateQaPayload(payload);
  const inspectedAt = new Date(payload.inspectedAt);
  if (Number.isNaN(inspectedAt.getTime())) {
    throw new ApiError(400, "Invalid inspection date", "INVALID_INSPECTION_DATE");
  }

  if (mutation.operationType === "qa.create") {
    const created = await tx.qaInspection.create({
      data: {
        inspectedAt,
        orderId: payload.orderId || null,
        vendorId: payload.vendorId || null,
        lineId: payload.lineId || null,
        stage: payload.stage,
        checkedQty: payload.checkedQty,
        approvedQty: payload.approvedQty,
        rejectedQty: payload.rejectedQty,
        reworkQty: payload.reworkQty,
      },
    });
    if (payload.defects.length) {
      await tx.qaInspectionDefect.createMany({
        data: payload.defects.map((defect) => ({
          inspectionId: created.id,
          defectTypeId: defect.defectTypeId,
          count: defect.count,
        })),
      });
    }
    await writeAuditLog(req, {
      tx,
      module: "sync",
      action: "CREATE",
      targetType: "QaInspection",
      targetId: created.id,
      targetLabel: created.id,
    });
    return { entityId: created.id };
  }

  const existing = await tx.qaInspection.findUnique({ where: { id: mutation.entityId } });
  if (!existing) throw new ApiError(404, "Inspection not found", "INSPECTION_NOT_FOUND");
  assertBaseVersion(mutation.baseVersion, existing.updatedAt.toISOString(), "qa_version_conflict", mutation.payload, {
    id: existing.id,
    inspectedAt: existing.inspectedAt.toISOString(),
  }, "QA inspection changed on the server.");
  const updated = await tx.qaInspection.update({
    where: { id: existing.id },
    data: {
      inspectedAt,
      orderId: payload.orderId || null,
      vendorId: payload.vendorId || null,
      lineId: payload.lineId || null,
      stage: payload.stage,
      checkedQty: payload.checkedQty,
      approvedQty: payload.approvedQty,
      rejectedQty: payload.rejectedQty,
      reworkQty: payload.reworkQty,
    },
  });
  await tx.qaInspectionDefect.deleteMany({ where: { inspectionId: existing.id } });
  if (payload.defects.length) {
    await tx.qaInspectionDefect.createMany({
      data: payload.defects.map((defect) => ({
        inspectionId: existing.id,
        defectTypeId: defect.defectTypeId,
        count: defect.count,
      })),
    });
  }
  await writeAuditLog(req, {
    tx,
    module: "sync",
    action: "UPDATE",
    targetType: "QaInspection",
    targetId: updated.id,
    targetLabel: updated.id,
  });
  return { entityId: updated.id };
}

function deriveOrderStatus(totalDelivered, quantity) {
  return totalDelivered >= quantity ? "DISPATCHED" : "READY_TO_DISPATCH";
}

function deriveShipmentStatus(totalDelivered, quantity) {
  return totalDelivered >= quantity ? "DISPATCHED" : "SCHEDULED";
}

async function processDispatchMutation(tx, req, mutation) {
  const payload = dispatchPayloadSchema.parse(mutation.payload);
  const dispatchDate = new Date(payload.dispatchDate);
  if (Number.isNaN(dispatchDate.getTime())) {
    throw new ApiError(400, "Invalid dispatch date", "INVALID_DISPATCH_DATE");
  }

  if (mutation.operationType === "dispatch.create") {
    const order = await tx.purchaseOrder.findUnique({ where: { id: payload.orderId } });
    if (!order) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
    const latest = await tx.dispatchShipment.findFirst({ orderBy: { createdAt: "desc" }, select: { shipmentNumber: true } });
    const last = latest?.shipmentNumber?.match(/SHIP-(\d+)/)?.[1];
    const nextNumber = `SHIP-${last ? Number(last) + 1 : 2402}`;
    const shipmentStatus = payload.status ?? deriveShipmentStatus(order.deliveredQty + payload.quantity, order.quantity);
    const deliveredQty = shipmentStatus === "CANCELLED" ? order.deliveredQty : order.deliveredQty + payload.quantity;
    const created = await tx.dispatchShipment.create({
      data: {
        shipmentNumber: nextNumber,
        orderId: order.id,
        dispatchDate,
        quantity: payload.quantity,
        invoiceNumber: payload.invoiceNumber?.trim() || null,
        status: shipmentStatus,
      },
    });
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        deliveredQty,
        status: deriveOrderStatus(deliveredQty, order.quantity),
      },
    });
    await writeAuditLog(req, {
      tx,
      module: "sync",
      action: "CREATE",
      targetType: "DispatchShipment",
      targetId: created.id,
      targetLabel: nextNumber,
    });
    return { entityId: created.id };
  }

  const shipment = await tx.dispatchShipment.findUnique({
    where: { id: mutation.entityId },
    include: { order: { include: { shipments: true } } },
  });
  if (!shipment) throw new ApiError(404, "Shipment not found", "SHIPMENT_NOT_FOUND");
  assertBaseVersion(mutation.baseVersion, shipment.updatedAt.toISOString(), "dispatch_version_conflict", mutation.payload, {
    id: shipment.id,
    quantity: shipment.quantity,
    status: shipment.status,
  }, "Shipment changed on the server.");
  const nextStatus = payload.status ?? shipment.status;
  const otherQty = shipment.order.shipments
    .filter((item) => item.id !== shipment.id && item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.quantity, 0);
  const currentQty = nextStatus === "CANCELLED" ? 0 : payload.quantity;
  const nextDeliveredQty = otherQty + currentQty;
  await tx.dispatchShipment.update({
    where: { id: shipment.id },
    data: {
      dispatchDate,
      quantity: payload.quantity,
      invoiceNumber: payload.invoiceNumber?.trim() || null,
      status: nextStatus,
    },
  });
  await tx.purchaseOrder.update({
    where: { id: shipment.orderId },
    data: {
      deliveredQty: nextDeliveredQty,
      status: deriveOrderStatus(nextDeliveredQty, shipment.order.quantity),
    },
  });
  await writeAuditLog(req, {
    tx,
    module: "sync",
    action: "UPDATE",
    targetType: "DispatchShipment",
    targetId: shipment.id,
    targetLabel: shipment.shipmentNumber,
  });
  return { entityId: shipment.id };
}

async function processMutation(tx, req, mutation) {
  if (mutation.operationType.startsWith("orders.")) return processOrderMutation(tx, req, mutation);
  if (mutation.operationType.startsWith("planning.")) return processPlanningMutation(tx, req, mutation);
  if (mutation.operationType.startsWith("inventory.")) return processInventoryMutation(tx, req, mutation);
  if (mutation.operationType.startsWith("qa.")) return processQaMutation(tx, req, mutation);
  if (mutation.operationType.startsWith("dispatch.")) return processDispatchMutation(tx, req, mutation);
  throw new ApiError(400, `Unsupported sync operation ${mutation.operationType}`, "UNSUPPORTED_SYNC_OPERATION");
}

async function recordConflict(deviceId, bundle, mutation, error) {
  const details = error.details ?? {};
  return prisma.syncConflict.create({
    data: {
      deviceId,
      bundleId: bundle.bundleId,
      mutationId: mutation.mutationId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      conflictType: details.conflictType ?? "sync_conflict",
      summary: details.summary ?? error.message,
      localSnapshot: details.localSnapshot ?? mutation.payload,
      serverSnapshot: details.serverSnapshot ?? null,
    },
  });
}

router.post("/push", asyncHandler(async (req, res) => {
  if (!ensureCompatibleClient(req, res)) return;

  const parsed = pushSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid sync push payload", "INVALID_SYNC_PUSH_PAYLOAD", parsed.error.flatten());
  }

  const clientVersion = getClientVersion(req);
  const deviceId = getDeviceId(req);
  const workspaceId = parsed.data.bundles[0]?.workspaceId ?? "default";
  const device = await ensureDesktopDevice(deviceId, clientVersion, workspaceId);
  if (device.status === "REVOKED") {
    return fail(res, 423, "This desktop device has been revoked", "DEVICE_REVOKED");
  }
  if (device.status === "LOCKED") {
    return fail(res, 423, "This desktop device is locked", "DEVICE_LOCKED");
  }
  if (device.status === "RESTRICTED") {
    return fail(res, 423, "This desktop device is in restricted mode and cannot push writes", "DEVICE_RESTRICTED");
  }
  if (device.rebuildRequired) {
    return fail(res, 409, "Desktop cache rebuild required before sync can continue", "REBUILD_REQUIRED");
  }

  const results = [];

  for (const bundle of parsed.data.bundles) {
    const existingBundle = await prisma.processedBundle.findUnique({ where: { bundleId: bundle.bundleId } });
    if (existingBundle) {
      results.push({
        bundleId: bundle.bundleId,
        status: "skipped",
        mutationResults: bundle.mutations.map((mutation) => ({
          mutationId: mutation.mutationId,
          status: "skipped",
        })),
      });
      continue;
    }

    try {
      const bundleResult = await prisma.$transaction(async (tx) => {
        const mutationResults = [];
        for (const mutation of bundle.mutations) {
          const existingMutation = await tx.processedMutation.findUnique({ where: { mutationId: mutation.mutationId } });
          if (existingMutation) {
            mutationResults.push({ mutationId: mutation.mutationId, status: "skipped" });
            continue;
          }

          const outcome = await processMutation(tx, req, mutation);
          mutationResults.push({ mutationId: mutation.mutationId, status: "synced" });
          const processedBundle = await tx.processedBundle.upsert({
            where: { bundleId: bundle.bundleId },
            create: {
              bundleId: bundle.bundleId,
              deviceId,
              workspaceId: bundle.workspaceId,
              entityType: bundle.entityType,
              entityId: outcome.entityId ?? bundle.entityId,
              operationType: bundle.operationType,
              clientVersion,
              result: { status: "synced" },
            },
            update: {},
          });
          await tx.processedMutation.create({
            data: {
              mutationId: mutation.mutationId,
              bundleId: bundle.bundleId,
              processedBundleId: processedBundle.id,
              deviceId,
              entityType: mutation.entityType,
              entityId: outcome.entityId ?? mutation.entityId,
              operationType: mutation.operationType,
              payload: mutation.payload,
              baseVersion: mutation.baseVersion ?? null,
              result: { status: "synced" },
            },
          });
        }
        return {
          bundleId: bundle.bundleId,
          status: "synced",
          mutationResults,
        };
      });
      results.push(bundleResult);
    } catch (error) {
      if (error instanceof ApiError && error.code === "SYNC_CONFLICT") {
        await recordConflict(deviceId, bundle, bundle.mutations[0], error);
        results.push({
          bundleId: bundle.bundleId,
          status: "conflict",
          code: error.code,
          message: error.message,
          mutationResults: bundle.mutations.map((mutation) => ({
            mutationId: mutation.mutationId,
            status: "conflict",
            code: error.code,
            message: error.message,
          })),
        });
      } else if (error instanceof ApiError) {
        results.push({
          bundleId: bundle.bundleId,
          status: "failed",
          code: error.code,
          message: error.message,
          mutationResults: bundle.mutations.map((mutation) => ({
            mutationId: mutation.mutationId,
            status: "failed",
            code: error.code,
            message: error.message,
          })),
        });
      } else {
        throw error;
      }
    }
  }

  return ok(res, { results });
}));

router.get("/pull", asyncHandler(async (req, res) => {
  if (!ensureCompatibleClient(req, res)) return;

  const clientVersion = getClientVersion(req);
  const deviceId = getDeviceId(req);
  const workspaceId = req.query.workspaceId?.toString() ?? "default";
  const device = await ensureDesktopDevice(deviceId, clientVersion, workspaceId);
  if (device.status === "REVOKED") {
    return fail(res, 423, "This desktop device has been revoked", "DEVICE_REVOKED");
  }

  const checkpointId = req.query.checkpointId?.toString() ?? null;
  const bootstrap = req.query.bootstrap === "1";
  let checkpointStatus = "ok";
  let snapshots = undefined;

  if (device.rebuildRequired) {
    checkpointStatus = "rebuild_required";
  } else if (!checkpointId) {
    snapshots = await buildAllSnapshots();
  } else {
    const checkpoint = await prisma.syncCheckpoint.findUnique({ where: { checkpointId } });
    if (!checkpoint) {
      checkpointStatus = "unknown_checkpoint";
      snapshots = await buildAllSnapshots();
    } else if (checkpoint.expiresAt < new Date()) {
      checkpointStatus = "expired_checkpoint";
      snapshots = await buildAllSnapshots();
    } else if (bootstrap || await hasRelevantChanges(checkpoint.cursorAt)) {
      snapshots = await buildAllSnapshots();
    }
  }

  const nextCheckpointId = randomUUID();
  await prisma.syncCheckpoint.create({
    data: {
      checkpointId: nextCheckpointId,
      deviceId,
      cursorAt: new Date(),
      expiresAt: new Date(Date.now() + CHECKPOINT_TTL_DAYS * 24 * 60 * 60 * 1000),
      status: checkpointStatus,
    },
  });

  return ok(res, {
    checkpointStatus,
    checkpointId: nextCheckpointId,
    entitlement: { state: mapDeviceAccessState(device.status) },
    rebuildState: {
      required: device.rebuildRequired,
      reason: device.rebuildRequired ? "server_requested_rebuild" : null,
    },
    snapshots,
  });
}));

router.get("/conflicts", asyncHandler(async (req, res) => {
  if (!ensureCompatibleClient(req, res)) return;
  const deviceId = getDeviceId(req);
  const conflicts = await prisma.syncConflict.findMany({
    where: { deviceId },
    orderBy: { createdAt: "desc" },
  });

  return ok(res, {
    items: conflicts.map((conflict) => ({
      id: conflict.id,
      deviceId: conflict.deviceId,
      bundleId: conflict.bundleId,
      mutationId: conflict.mutationId,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      conflictType: conflict.conflictType,
      summary: conflict.summary,
      localSnapshot: conflict.localSnapshot,
      serverSnapshot: conflict.serverSnapshot,
      chosenAction: conflict.chosenAction ?? null,
      rationale: conflict.rationale ?? null,
      createdAt: conflict.createdAt.toISOString(),
    })),
  });
}));

router.post("/conflicts/:id/resolve", asyncHandler(async (req, res) => {
  if (!ensureCompatibleClient(req, res)) return;
  const deviceId = getDeviceId(req);
  const parsed = z.object({
    choice: z.enum(["keep_local", "keep_server", "dismiss"]),
    rationale: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid conflict resolution payload", "INVALID_CONFLICT_RESOLUTION", parsed.error.flatten());
  }

  const conflict = await prisma.syncConflict.findUnique({ where: { id: req.params.id } });
  if (!conflict || conflict.deviceId !== deviceId) {
    return fail(res, 404, "Conflict not found", "SYNC_CONFLICT_NOT_FOUND");
  }

  await prisma.syncConflict.update({
    where: { id: conflict.id },
    data: {
      chosenAction: parsed.data.choice,
      rationale: parsed.data.rationale ?? null,
    },
  });

  if (parsed.data.choice === "keep_server" || parsed.data.choice === "dismiss") {
    await prisma.syncConflict.delete({ where: { id: conflict.id } });
  }

  return ok(res, { ok: true });
}));

export default router;
