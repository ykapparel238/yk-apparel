import { z } from "zod";
import { prisma } from "./db.mjs";
import { ApiError } from "./http.mjs";
import { writeAuditLog } from "./audit.mjs";

const orderPayload = z.object({
  brandId: z.string().min(1),
  styleId: z.string().min(1),
  poNumber: z.string().min(3),
  seasonCode: z.string().min(2),
  quantity: z.coerce.number().int().positive(),
  dueDate: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  notes: z.string().optional().default(""),
  sizeAllocations: z.array(z.object({ sizeLabel: z.string().min(1), percent: z.coerce.number().int().min(0).max(100) })).optional(),
  colorAllocations: z.array(z.object({ colorName: z.string().min(1), hexCode: z.string().optional().nullable(), percent: z.coerce.number().int().min(0).max(100) })).optional(),
});

const planPayload = z.object({
  orderId: z.string().min(1),
  lineId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  plannedQty: z.coerce.number().int().positive(),
});

const productionEntryPayload = z.object({
  metricDate: z.string().min(1),
  lineId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),
  stage: z.string().min(1),
  plannedQty: z.coerce.number().int().min(0),
  actualQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
  downtimeMinutes: z.coerce.number().int().min(0),
  downtimeReasonId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const procurementRequestPayload = z.object({
  requestedQty: z.coerce.number().positive().optional(),
  note: z.string().min(2).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

const supplierPoPayload = z.object({
  orderedQty: z.coerce.number().positive().optional(),
  expectedDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ISSUED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"]).optional(),
});

const qaInspectionPayload = z.object({
  inspectedAt: z.string().min(1),
  orderId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  lineId: z.string().optional().nullable(),
  stage: z.string().min(1),
  checkedQty: z.coerce.number().int().min(0),
  approvedQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
  reworkQty: z.coerce.number().int().min(0),
  defects: z.array(z.object({ defectTypeId: z.string().min(1), count: z.coerce.number().int().min(0) })).default([]),
});

const capaPayload = z.object({
  inspectionId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  lineId: z.string().optional().nullable(),
  title: z.string().min(2),
  rootCause: z.string().min(2),
  ownerName: z.string().min(2),
  dueDate: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

const challanPayload = z.object({
  inwardQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
});

const shipmentPayload = z.object({
  dispatchDate: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  invoiceNumber: z.string().optional(),
  status: z.enum(["READY", "SCHEDULED", "DISPATCHED", "CANCELLED"]).optional(),
});

function parse(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid proposed payload", "INVALID_PROPOSED_PAYLOAD", parsed.error.flatten());
  }
  return parsed.data;
}

function toDate(value, code) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Invalid proposed date", code);
  return date;
}

function allocationTotal(items, label) {
  if (!items?.length) return;
  const total = items.reduce((sum, item) => sum + item.percent, 0);
  if (total !== 100) throw new ApiError(400, `${label} must total 100%`, "INVALID_ALLOCATION_TOTAL", { total });
}

function deriveDispatchOrderStatus(totalDelivered, quantity) {
  return totalDelivered >= quantity ? "DISPATCHED" : "READY_TO_DISPATCH";
}

export async function applyWorkflowChangeRequest(req, item) {
  const payload = item.proposedPayload;

  if (item.entityType === "PurchaseOrder" && item.operation === "update") {
    const data = parse(orderPayload, payload);
    const dueDate = toDate(data.dueDate, "INVALID_DUE_DATE");
    allocationTotal(data.sizeAllocations, "Size allocation");
    allocationTotal(data.colorAllocations, "Color allocation");
    const [existing, duplicateOrder] = await Promise.all([
      prisma.purchaseOrder.findUnique({
        where: { id: item.entityId },
        include: { brand: true, style: true },
      }),
      prisma.purchaseOrder.findFirst({
        where: {
          poNumber: data.poNumber.trim().toUpperCase(),
          id: { not: item.entityId },
        },
      }),
    ]);
    if (!existing) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
    if (duplicateOrder) throw new ApiError(409, "PO number already exists", "DUPLICATE_PO_NUMBER");
    if (data.quantity < existing.deliveredQty) throw new ApiError(409, "Order quantity cannot be lower than already delivered quantity", "INVALID_ORDER_QUANTITY");
    return prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.update({
        where: { id: item.entityId },
        data: {
          brandId: data.brandId,
          styleId: data.styleId,
          poNumber: data.poNumber.trim().toUpperCase(),
          seasonCode: data.seasonCode.trim().toUpperCase(),
          quantity: data.quantity,
          dueDate,
          priority: data.priority,
          notes: data.notes?.trim() ?? "",
        },
      });
      if (data.sizeAllocations) {
        await tx.purchaseOrderSizeAllocation.deleteMany({ where: { orderId: order.id } });
        await tx.purchaseOrderSizeAllocation.createMany({ data: data.sizeAllocations.map((entry) => ({ orderId: order.id, ...entry })) });
      }
      if (data.colorAllocations) {
        await tx.purchaseOrderColorAllocation.deleteMany({ where: { orderId: order.id } });
        await tx.purchaseOrderColorAllocation.createMany({ data: data.colorAllocations.map((entry) => ({ orderId: order.id, ...entry })) });
      }
      await writeAuditLog(req, { tx, module: "Workflow", action: "Approved order change request", targetType: "PurchaseOrder", targetId: order.id, targetLabel: order.poNumber });
      return order;
    });
  }

  if (item.entityType === "PurchaseOrder" && item.operation === "delete") {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: item.entityId },
      include: {
        productionPlans: { select: { id: true } },
        challans: { select: { id: true } },
        qaInspections: { select: { id: true } },
        shipments: { select: { id: true } },
      },
    });
    if (!order) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
    if (order.productionPlans.length || order.challans.length || order.qaInspections.length || order.shipments.length) {
      throw new ApiError(409, "Order cannot be deleted once execution records exist", "ORDER_HAS_EXECUTION_RECORDS");
    }
    return prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.delete({ where: { id: item.entityId } });
      await writeAuditLog(req, { tx, module: "Workflow", action: "Approved order delete request", targetType: "PurchaseOrder", targetId: order.id, targetLabel: order.poNumber });
      return order;
    });
  }

  if (item.entityType === "ProductionPlan" && item.operation === "update") {
    const data = parse(planPayload, payload);
    const startDate = toDate(data.startDate, "INVALID_PLAN_DATES");
    const endDate = toDate(data.endDate, "INVALID_PLAN_DATES");
    if (endDate < startDate) throw new ApiError(400, "Plan end date must be on or after start date", "INVALID_PLAN_WINDOW");
    return prisma.$transaction(async (tx) => {
      const plan = await tx.productionPlan.update({
        where: { id: item.entityId },
        data: { orderId: data.orderId, lineId: data.lineId, startDate, endDate, plannedQty: data.plannedQty, dailyTarget: Math.round(data.plannedQty / Math.max(1, Math.ceil((endDate - startDate) / 86400000) + 1)) },
        include: { order: true, line: true },
      });
      await writeAuditLog(req, { tx, module: "Workflow", action: "Approved planning change request", targetType: "ProductionPlan", targetId: plan.id, targetLabel: `${plan.order.poNumber} -> ${plan.line.name}` });
      return plan;
    });
  }

  if (item.entityType === "ProductionEntry" && item.operation === "update") {
    const data = parse(productionEntryPayload, payload);
    if (data.rejectedQty > data.actualQty) throw new ApiError(409, "Rejected quantity cannot exceed actual quantity", "INVALID_REJECTED_QTY");
    const metricDate = toDate(data.metricDate, "INVALID_PRODUCTION_DATE");
    const entry = await prisma.productionEntry.update({
      where: { id: item.entityId },
      data: {
        metricDate,
        lineId: data.lineId,
        orderId: data.orderId || null,
        shiftId: data.shiftId || null,
        stage: data.stage,
        plannedQty: data.plannedQty,
        actualQty: data.actualQty,
        rejectedQty: data.rejectedQty,
        downtimeMinutes: data.downtimeMinutes,
        downtimeReasonId: data.downtimeReasonId || null,
        remarks: data.remarks?.trim() || null,
      },
    });
    await writeAuditLog(req, { module: "Workflow", action: "Approved production change request", targetType: "ProductionEntry", targetId: entry.id, targetLabel: entry.id });
    return entry;
  }

  if (item.entityType === "ProcurementRequest" && item.operation === "update") {
    const data = parse(procurementRequestPayload, payload);
    const updated = await prisma.procurementRequest.update({
      where: { id: item.entityId },
      data: { requestedQty: data.requestedQty?.toFixed(2), note: data.note?.trim(), status: data.status },
    });
    await writeAuditLog(req, { module: "Workflow", action: "Approved procurement request change", targetType: "ProcurementRequest", targetId: updated.id, targetLabel: updated.id });
    return updated;
  }

  if (item.entityType === "SupplierPurchaseOrder" && item.operation === "update") {
    const data = parse(supplierPoPayload, payload);
    const expectedDate = data.expectedDate ? toDate(data.expectedDate, "INVALID_EXPECTED_DATE") : undefined;
    return prisma.$transaction(async (tx) => {
      const po = await tx.supplierPurchaseOrder.update({
        where: { id: item.entityId },
        data: { expectedDate, note: data.note?.trim(), status: data.status },
        include: { lines: true },
      });
      if (data.orderedQty && po.lines[0]) {
        await tx.supplierPurchaseOrderLine.update({ where: { id: po.lines[0].id }, data: { orderedQty: data.orderedQty.toFixed(2) } });
      }
      await writeAuditLog(req, { tx, module: "Workflow", action: "Approved supplier PO change", targetType: "SupplierPurchaseOrder", targetId: po.id, targetLabel: po.poNumber });
      return po;
    });
  }

  if (item.entityType === "QaInspection" && item.operation === "update") {
    const data = parse(qaInspectionPayload, payload);
    if (data.approvedQty + data.rejectedQty + data.reworkQty > data.checkedQty) throw new ApiError(409, "Approved, rejected and rework totals cannot exceed checked quantity", "INVALID_INSPECTION_TOTALS");
    const inspectedAt = toDate(data.inspectedAt, "INVALID_INSPECTION_DATE");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.qaInspection.update({
        where: { id: item.entityId },
        data: { inspectedAt, orderId: data.orderId || null, vendorId: data.vendorId || null, lineId: data.lineId || null, stage: data.stage, checkedQty: data.checkedQty, approvedQty: data.approvedQty, rejectedQty: data.rejectedQty, reworkQty: data.reworkQty },
      });
      await tx.qaInspectionDefect.deleteMany({ where: { inspectionId: updated.id } });
      if (data.defects.length) await tx.qaInspectionDefect.createMany({ data: data.defects.map((defect) => ({ inspectionId: updated.id, defectTypeId: defect.defectTypeId, count: defect.count })) });
      await writeAuditLog(req, { tx, module: "Workflow", action: "Approved QA inspection change", targetType: "QaInspection", targetId: updated.id, targetLabel: `Inspection ${updated.id}` });
      return updated;
    });
  }

  if (item.entityType === "CorrectiveAction" && item.operation === "update") {
    const data = parse(capaPayload, payload);
    const dueDate = toDate(data.dueDate, "INVALID_CAPA_DATE");
    const updated = await prisma.correctiveAction.update({
      where: { id: item.entityId },
      data: { inspectionId: data.inspectionId || null, vendorId: data.vendorId || null, orderId: data.orderId || null, lineId: data.lineId || null, title: data.title.trim(), rootCause: data.rootCause.trim(), ownerName: data.ownerName.trim(), dueDate, status: data.status },
    });
    await writeAuditLog(req, { module: "Workflow", action: "Approved CAPA change", targetType: "CorrectiveAction", targetId: updated.id, targetLabel: updated.title });
    return updated;
  }

  if (item.entityType === "VendorChallan" && item.operation === "update") {
    const data = parse(challanPayload, payload);
    const challan = await prisma.vendorChallan.findUnique({ where: { id: item.entityId } });
    if (!challan) throw new ApiError(404, "Challan not found", "CHALLAN_NOT_FOUND");
    if (data.inwardQty + data.rejectedQty > challan.outwardQty) throw new ApiError(409, "Inward and rejected quantity cannot exceed outward quantity", "INVALID_CHALLAN_TOTALS");
    const status = data.inwardQty === 0 && data.rejectedQty === 0 ? "OPEN" : data.inwardQty + data.rejectedQty >= challan.outwardQty ? "CLOSED" : "PARTIAL";
    const updated = await prisma.vendorChallan.update({ where: { id: item.entityId }, data: { inwardQty: data.inwardQty, rejectedQty: data.rejectedQty, status } });
    await writeAuditLog(req, { module: "Workflow", action: "Approved challan change", targetType: "VendorChallan", targetId: updated.id, targetLabel: updated.challanNumber });
    return updated;
  }

  if (item.entityType === "DispatchShipment" && item.operation === "update") {
    const data = parse(shipmentPayload, payload);
    const dispatchDate = toDate(data.dispatchDate, "INVALID_DISPATCH_DATE");
    const shipment = await prisma.dispatchShipment.findUnique({ where: { id: item.entityId }, include: { order: { include: { shipments: true } } } });
    if (!shipment) throw new ApiError(404, "Shipment not found", "SHIPMENT_NOT_FOUND");
    const nextStatus = data.status ?? shipment.status;
    const otherQty = shipment.order.shipments.filter((entry) => entry.id !== shipment.id && entry.status !== "CANCELLED").reduce((sum, entry) => sum + entry.quantity, 0);
    const nextDeliveredQty = otherQty + (nextStatus === "CANCELLED" ? 0 : data.quantity);
    if (nextDeliveredQty > shipment.order.quantity) throw new ApiError(409, "Dispatch quantity exceeds remaining balance", "OVER_DISPATCH");
    return prisma.$transaction(async (tx) => {
      const updated = await tx.dispatchShipment.update({ where: { id: shipment.id }, data: { dispatchDate, quantity: data.quantity, invoiceNumber: data.invoiceNumber?.trim() || null, status: nextStatus } });
      await tx.purchaseOrder.update({ where: { id: shipment.orderId }, data: { deliveredQty: nextDeliveredQty, status: deriveDispatchOrderStatus(nextDeliveredQty, shipment.order.quantity) } });
      await writeAuditLog(req, { tx, module: "Workflow", action: "Approved dispatch change", targetType: "DispatchShipment", targetId: updated.id, targetLabel: updated.shipmentNumber });
      return updated;
    });
  }

  throw new ApiError(400, "This change request type cannot be applied automatically", "UNSUPPORTED_CHANGE_REQUEST");
}
