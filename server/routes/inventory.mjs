import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, requireRoles, asyncHandler } from "../http.mjs";

const router = Router();

const adjustmentSchema = z.object({
  sku: z.string().min(1),
  deltaQty: z.coerce.number().refine((value) => value !== 0, "Adjustment cannot be zero"),
  reason: z.string().min(2),
});

function mapType(value) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

router.get("/", asyncHandler(async (_req, res) => {
  const materials = await prisma.material.findMany({
    orderBy: { sku: "asc" },
    include: { supplier: true },
  });

  const items = materials.map((material) => ({
    id: material.sku,
    name: material.name,
    type: mapType(material.type),
    uom: material.uom,
    stock: Number(material.stockQty),
    min: Number(material.reorderLevel),
    allocated: Number(material.allocatedQty),
    supplier: material.supplier?.name ?? "Unassigned",
  }));

  return ok(res, {
    items,
    lowStockCount: items.filter((item) => item.stock <= item.min).length,
  });
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

export default router;
