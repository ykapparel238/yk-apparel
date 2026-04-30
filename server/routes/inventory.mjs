import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, requireRoles, asyncHandler } from "../http.mjs";
import { buildMrpItems } from "./mrp.mjs";
import { ACTIVE_ORDER_STATUSES } from "../constants.mjs";

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

router.get("/", asyncHandler(async (_req, res) => {
  const [materials, procurementRequests, bomItems, orders] = await Promise.all([
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

    return ok(res, { item: mapProcurementRequest(updated) });
  }),
);

export default router;
