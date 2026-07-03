import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, requireRoles, asyncHandler } from "../http.mjs";
import { buildMrpItems } from "./mrp.mjs";
import { ACTIVE_ORDER_STATUSES } from "../constants.mjs";
import { enforceWorkflowEditLimit, recordWorkflowEditLock } from "../workflow-control.mjs";

const router = Router();

const adjustmentSchema = z.object({
  sku: z.string().min(1),
  deltaQty: z.coerce.number().refine((value) => value !== 0, "Adjustment cannot be zero"),
  reason: z.string().min(2),
});

const procurementRequestSchema = z.object({
  materialId: z.string().min(1),
  requestedQty: z.coerce.number().positive(),
  note: z.string().min(2),
});

const procurementRequestUpdateSchema = z.object({
  requestedQty: z.coerce.number().positive().optional(),
  note: z.string().min(2).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

const purchaseOrderSchema = z.object({
  procurementRequestId: z.string().min(1),
  orderedQty: z.coerce.number().positive(),
  expectedDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

const purchaseOrderUpdateSchema = z.object({
  orderedQty: z.coerce.number().positive().optional(),
  expectedDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ISSUED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"]).optional(),
});

const goodsReceiptSchema = z.object({
  purchaseOrderId: z.string().min(1),
  receivedQty: z.coerce.number().positive(),
  receivedAt: z.string().min(1),
  note: z.string().optional().nullable(),
});

function mapType(value) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapProcurementStatus(value) {
  if (value === "IN_PROGRESS") return "In Progress";
  return mapType(value);
}

function mapProcurementRequest(item) {
  return {
    id: item.id,
    materialId: item.materialId,
    sku: item.material.sku,
    material: item.material.name,
    supplier: item.supplier?.name ?? item.material.supplier?.name ?? "Unassigned",
    shortageQty: Number(item.shortageQty),
    requestedQty: Number(item.requestedQty),
    note: item.note,
    status: mapProcurementStatus(item.status),
    createdBy: item.createdBy?.name ?? "System",
    createdAt: item.createdAt.toISOString().slice(0, 10),
  };
}

function mapPurchaseOrderStatus(value) {
  return mapType(value);
}

function mapPurchaseOrder(item) {
  const line = item.lines[0];
  return {
    id: item.id,
    poNumber: item.poNumber,
    procurementRequestId: item.procurementRequestId ?? null,
    supplierId: item.supplierId,
    supplier: item.supplier.name,
    materialId: line?.materialId ?? null,
    material: line?.material.name ?? null,
    sku: line?.material.sku ?? null,
    requestedQty: Number(line?.requestedQty ?? 0),
    orderedQty: Number(line?.orderedQty ?? 0),
    receivedQty: Number(line?.receivedQty ?? 0),
    balanceQty: Math.max(0, Number(line?.orderedQty ?? 0) - Number(line?.receivedQty ?? 0)),
    uom: line?.uom ?? "",
    status: mapPurchaseOrderStatus(item.status),
    expectedDate: item.expectedDate ? item.expectedDate.toISOString().slice(0, 10) : null,
    note: item.note ?? "",
    receipts: item.receipts.length,
  };
}

router.get("/", asyncHandler(async (_req, res) => {
  const [materials, procurementRequests, purchaseOrders, bomItems, orders] = await Promise.all([
    prisma.material.findMany({
      orderBy: { sku: "asc" },
      include: { supplier: true },
    }),
    prisma.procurementRequest.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      include: {
        supplier: true,
        material: { include: { supplier: true } },
        createdBy: true,
      },
    }),
    prisma.supplierPurchaseOrder.findMany({
      include: {
        supplier: true,
        lines: {
          include: {
            material: true,
          },
        },
        receipts: true,
      },
      orderBy: { orderDate: "desc" },
    }),
    prisma.billOfMaterialItem.findMany({
      include: {
        material: { include: { supplier: true } },
        style: true,
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
    }),
  ]);

  const mrpItems = buildMrpItems(bomItems, materials, orders);
  const mrpMap = new Map(mrpItems.map((item) => [item.materialId, item]));
  const activeRequestMap = new Map(procurementRequests.map((item) => [item.materialId, mapProcurementRequest(item)]));

  const items = materials.map((material) => ({
    id: material.sku,
    materialId: material.id,
    name: material.name,
    type: mapType(material.type),
    uom: material.uom,
    stock: Number(material.stockQty),
    min: Number(material.reorderLevel),
    allocated: Number(material.allocatedQty),
    supplier: material.supplier?.name ?? "Unassigned",
    shortage: mrpMap.get(material.id)?.shortage ?? 0,
    activeProcurementRequest: activeRequestMap.get(material.id) ?? null,
  }));

  return ok(res, {
    items,
    lowStockCount: items.filter((item) => item.stock <= item.min).length,
    purchaseOrders: purchaseOrders.map(mapPurchaseOrder),
  });
}));

router.get("/procurement-requests", asyncHandler(async (_req, res) => {
  const requests = await prisma.procurementRequest.findMany({
    include: {
      supplier: true,
      material: { include: { supplier: true } },
      createdBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(res, { items: requests.map(mapProcurementRequest) });
}));

router.get("/purchase-orders", asyncHandler(async (_req, res) => {
  const orders = await prisma.supplierPurchaseOrder.findMany({
    include: {
      supplier: true,
      lines: {
        include: { material: true },
      },
      receipts: true,
    },
    orderBy: { orderDate: "desc" },
  });

  return ok(res, { items: orders.map(mapPurchaseOrder) });
}));

router.post(
  "/adjustments",
  requireRoles("ADMIN", "STORE_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid inventory adjustment payload", "INVALID_INVENTORY_ADJUSTMENT", parsed.error.flatten());
    }

    const material = await prisma.material.findUnique({
      where: { sku: parsed.data.sku },
      include: { supplier: true },
    });
    if (!material) {
      return fail(res, 404, "Material not found", "MATERIAL_NOT_FOUND");
    }

    const nextStock = Number(material.stockQty) + parsed.data.deltaQty;
    if (nextStock < 0) {
      return fail(res, 409, "Stock cannot go below zero", "NEGATIVE_STOCK");
    }
    if (nextStock < Number(material.allocatedQty)) {
      return fail(res, 409, "Stock cannot go below allocated quantity", "ALLOCATED_STOCK_CONFLICT");
    }

    const updated = await prisma.material.update({
      where: { id: material.id },
      data: { stockQty: nextStock.toFixed(2) },
      include: { supplier: true },
    });

    await writeAuditLog(req, {
      module: "Inventory",
      action: `Adjusted stock (${parsed.data.deltaQty > 0 ? "increase" : "decrease"})`,
      targetType: "Material",
      targetId: updated.id,
      targetLabel: `${updated.sku} / ${parsed.data.reason}`,
    });

    return ok(res, {
      item: {
        id: updated.sku,
        name: updated.name,
        type: mapType(updated.type),
        uom: updated.uom,
        stock: Number(updated.stockQty),
        min: Number(updated.reorderLevel),
        allocated: Number(updated.allocatedQty),
        supplier: updated.supplier?.name ?? "Unassigned",
      },
    }, 201);
  }),
);

router.post(
  "/procurement-requests",
  requireRoles("ADMIN", "STORE_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = procurementRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid procurement request payload", "INVALID_PROCUREMENT_REQUEST", parsed.error.flatten());
    }

    const [material, existingOpen, bomItems, orders] = await Promise.all([
      prisma.material.findUnique({
        where: { id: parsed.data.materialId },
        include: { supplier: true },
      }),
      prisma.procurementRequest.findFirst({
        where: {
          materialId: parsed.data.materialId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      prisma.billOfMaterialItem.findMany({
        where: { materialId: parsed.data.materialId },
        include: { material: { include: { supplier: true } }, style: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { status: { in: ACTIVE_ORDER_STATUSES } },
      }),
    ]);

    if (!material) {
      return fail(res, 404, "Material not found", "MATERIAL_NOT_FOUND");
    }
    if (existingOpen) {
      return fail(res, 409, "An active procurement request already exists for this material", "PROCUREMENT_REQUEST_EXISTS");
    }

    const shortageItem = buildMrpItems(bomItems, [material], orders)[0];
    const shortageQty = shortageItem?.shortage ?? 0;
    if (shortageQty <= 0) {
      return fail(res, 409, "Procurement requests are only allowed for materials with active shortage", "NO_ACTIVE_SHORTAGE");
    }

    const created = await prisma.procurementRequest.create({
      data: {
        materialId: material.id,
        supplierId: material.supplierId ?? null,
        createdByUserId: req.sessionUser?.id ?? null,
        shortageQty: shortageQty.toFixed(2),
        requestedQty: parsed.data.requestedQty.toFixed(2),
        note: parsed.data.note.trim(),
        status: "OPEN",
      },
      include: {
        supplier: true,
        material: { include: { supplier: true } },
        createdBy: true,
      },
    });

    await writeAuditLog(req, {
      module: "Inventory",
      action: "Created procurement request",
      targetType: "ProcurementRequest",
      targetId: created.id,
      targetLabel: `${created.material.sku} / ${created.requestedQty}`,
    });

    return ok(res, { item: mapProcurementRequest(created) }, 201);
  }),
);

router.patch(
  "/procurement-requests/:id",
  requireRoles("ADMIN", "STORE_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = procurementRequestUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid procurement request update payload", "INVALID_PROCUREMENT_REQUEST_UPDATE", parsed.error.flatten());
    }

    const existing = await prisma.procurementRequest.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        material: { include: { supplier: true } },
        createdBy: true,
      },
    });
    if (!existing) {
      return fail(res, 404, "Procurement request not found", "PROCUREMENT_REQUEST_NOT_FOUND");
    }

    const workflowMeta = { module: "inventory", entityType: "ProcurementRequest", entityId: existing.id, operation: "update" };
    await enforceWorkflowEditLimit(req, workflowMeta);

    const updated = await prisma.procurementRequest.update({
      where: { id: req.params.id },
      data: {
        requestedQty: parsed.data.requestedQty?.toFixed(2),
        note: parsed.data.note?.trim(),
        status: parsed.data.status,
      },
      include: {
        supplier: true,
        material: { include: { supplier: true } },
        createdBy: true,
      },
    });

    await writeAuditLog(req, {
      module: "Inventory",
      action: "Updated procurement request",
      targetType: "ProcurementRequest",
      targetId: updated.id,
      targetLabel: `${updated.material.sku} / ${updated.requestedQty}`,
    });
    await recordWorkflowEditLock(req, workflowMeta);

    return ok(res, { item: mapProcurementRequest(updated) });
  }),
);

router.post(
  "/purchase-orders",
  requireRoles("ADMIN", "STORE_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = purchaseOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid supplier PO payload", "INVALID_SUPPLIER_PO", parsed.error.flatten());
    }

    const expectedDate = parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : null;
    if (parsed.data.expectedDate && Number.isNaN(expectedDate?.getTime())) {
      return fail(res, 400, "Invalid expected date", "INVALID_EXPECTED_DATE");
    }

    const [requestItem, existingPo, latestPo] = await Promise.all([
      prisma.procurementRequest.findUnique({
        where: { id: parsed.data.procurementRequestId },
        include: {
          material: true,
          supplier: true,
        },
      }),
      prisma.supplierPurchaseOrder.findFirst({
        where: {
          procurementRequestId: parsed.data.procurementRequestId,
          status: { in: ["DRAFT", "ISSUED", "PARTIAL_RECEIVED"] },
        },
      }),
      prisma.supplierPurchaseOrder.findFirst({
        orderBy: { createdAt: "desc" },
        select: { poNumber: true },
      }),
    ]);

    if (!requestItem) {
      return fail(res, 404, "Procurement request not found", "PROCUREMENT_REQUEST_NOT_FOUND");
    }
    if (existingPo) {
      return fail(res, 409, "An active supplier PO already exists for this request", "SUPPLIER_PO_EXISTS");
    }

    const nextNumber = (() => {
      const last = latestPo?.poNumber?.match(/SPO-(\d+)/)?.[1];
      const serial = last ? Number(last) + 1 : 2401;
      return `SPO-${serial}`;
    })();

    const created = await prisma.$transaction(async (tx) => {
      const po = await tx.supplierPurchaseOrder.create({
        data: {
          poNumber: nextNumber,
          supplierId: requestItem.supplierId ?? requestItem.material.supplierId,
          procurementRequestId: requestItem.id,
          status: "ISSUED",
          expectedDate,
          note: parsed.data.note?.trim() || requestItem.note,
          lines: {
            create: [{
              materialId: requestItem.materialId,
              requestedQty: requestItem.requestedQty.toFixed(2),
              orderedQty: parsed.data.orderedQty.toFixed(2),
              uom: requestItem.material.uom,
            }],
          },
        },
        include: {
          supplier: true,
          lines: { include: { material: true } },
          receipts: true,
        },
      });

      await tx.procurementRequest.update({
        where: { id: requestItem.id },
        data: { status: "IN_PROGRESS" },
      });

      await writeAuditLog(req, {
        tx,
        module: "Inventory",
        action: "Created supplier PO",
        targetType: "SupplierPurchaseOrder",
        targetId: po.id,
        targetLabel: po.poNumber,
      });

      return po;
    });

    return ok(res, { item: mapPurchaseOrder(created) }, 201);
  }),
);

router.patch(
  "/purchase-orders/:id",
  requireRoles("ADMIN", "STORE_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = purchaseOrderUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid supplier PO update payload", "INVALID_SUPPLIER_PO_UPDATE", parsed.error.flatten());
    }

    const existing = await prisma.supplierPurchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        lines: { include: { material: true } },
        receipts: true,
      },
    });
    if (!existing) {
      return fail(res, 404, "Supplier PO not found", "SUPPLIER_PO_NOT_FOUND");
    }

    const workflowMeta = { module: "inventory", entityType: "SupplierPurchaseOrder", entityId: existing.id, operation: "update" };
    await enforceWorkflowEditLimit(req, workflowMeta);

    const expectedDate = parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : undefined;
    if (parsed.data.expectedDate && Number.isNaN(expectedDate?.getTime())) {
      return fail(res, 400, "Invalid expected date", "INVALID_EXPECTED_DATE");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.supplierPurchaseOrder.update({
        where: { id: existing.id },
        data: {
          expectedDate,
          note: parsed.data.note?.trim(),
          status: parsed.data.status,
        },
        include: {
          supplier: true,
          lines: { include: { material: true } },
          receipts: true,
        },
      });

      if (parsed.data.orderedQty) {
        await tx.supplierPurchaseOrderLine.update({
          where: { id: po.lines[0].id },
          data: { orderedQty: parsed.data.orderedQty.toFixed(2) },
        });
      }

      await writeAuditLog(req, {
        tx,
        module: "Inventory",
        action: "Updated supplier PO",
        targetType: "SupplierPurchaseOrder",
        targetId: po.id,
        targetLabel: po.poNumber,
      });
      await recordWorkflowEditLock(req, workflowMeta, tx);

      return tx.supplierPurchaseOrder.findUnique({
        where: { id: existing.id },
        include: {
          supplier: true,
          lines: { include: { material: true } },
          receipts: true,
        },
      });
    });

    return ok(res, { item: mapPurchaseOrder(updated) });
  }),
);

router.post(
  "/goods-receipts",
  requireRoles("ADMIN", "STORE_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = goodsReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid goods receipt payload", "INVALID_GOODS_RECEIPT", parsed.error.flatten());
    }

    const receivedAt = new Date(parsed.data.receivedAt);
    if (Number.isNaN(receivedAt.getTime())) {
      return fail(res, 400, "Invalid receipt date", "INVALID_RECEIPT_DATE");
    }

    const [purchaseOrder, latestReceipt] = await Promise.all([
      prisma.supplierPurchaseOrder.findUnique({
        where: { id: parsed.data.purchaseOrderId },
        include: {
          procurementRequest: true,
          lines: { include: { material: true } },
          supplier: true,
          receipts: true,
        },
      }),
      prisma.goodsReceipt.findFirst({
        orderBy: { createdAt: "desc" },
        select: { receiptNumber: true },
      }),
    ]);

    if (!purchaseOrder) {
      return fail(res, 404, "Supplier PO not found", "SUPPLIER_PO_NOT_FOUND");
    }

    const line = purchaseOrder.lines[0];
    const remaining = Number(line.orderedQty) - Number(line.receivedQty);
    if (parsed.data.receivedQty > remaining) {
      return fail(res, 409, "Receipt quantity cannot exceed PO balance", "EXCESS_RECEIPT_QTY", { remaining });
    }

    const nextNumber = (() => {
      const last = latestReceipt?.receiptNumber?.match(/GRN-(\d+)/)?.[1];
      const serial = last ? Number(last) + 1 : 2401;
      return `GRN-${serial}`;
    })();

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNumber: nextNumber,
          purchaseOrderId: purchaseOrder.id,
          receivedAt,
          note: parsed.data.note?.trim() || null,
        },
      });

      await tx.goodsReceiptLine.create({
        data: {
          goodsReceiptId: receipt.id,
          purchaseOrderLineId: line.id,
          receivedQty: parsed.data.receivedQty.toFixed(2),
        },
      });

      const updatedLine = await tx.supplierPurchaseOrderLine.update({
        where: { id: line.id },
        data: {
          receivedQty: (Number(line.receivedQty) + parsed.data.receivedQty).toFixed(2),
        },
      });

      await tx.material.update({
        where: { id: line.materialId },
        data: {
          stockQty: (Number(line.material.stockQty) + parsed.data.receivedQty).toFixed(2),
        },
      });

      const fullyReceived = Number(updatedLine.receivedQty) >= Number(updatedLine.orderedQty);
      await tx.supplierPurchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: fullyReceived ? "RECEIVED" : "PARTIAL_RECEIVED",
        },
      });

      if (purchaseOrder.procurementRequestId && fullyReceived) {
        await tx.procurementRequest.update({
          where: { id: purchaseOrder.procurementRequestId },
          data: { status: "CLOSED" },
        });
      }

      await writeAuditLog(req, {
        tx,
        module: "Inventory",
        action: "Received goods",
        targetType: "GoodsReceipt",
        targetId: receipt.id,
        targetLabel: receipt.receiptNumber,
      });

      return receipt;
    });

    return ok(res, { item: { id: result.id, receiptNumber: result.receiptNumber } }, 201);
  }),
);

export default router;
