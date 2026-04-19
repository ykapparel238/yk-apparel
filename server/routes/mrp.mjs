import { Router } from "express";
import { prisma } from "../db.mjs";

const router = Router();

router.get("/", async (_req, res) => {
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
      where: {
        status: {
          in: ["CREATED", "PLANNED", "IN_PRODUCTION", "QA", "DELAYED", "READY_TO_DISPATCH"],
        },
      },
    }),
  ]);

  const demandByStyle = new Map();
  orders.forEach((order) => {
    demandByStyle.set(order.styleId, (demandByStyle.get(order.styleId) ?? 0) + Math.max(0, order.quantity - order.deliveredQty));
  });

  const requiredByMaterial = new Map();
  bomItems.forEach((item) => {
    const demandQty = demandByStyle.get(item.styleId) ?? 0;
    const required = Number(item.quantityPerPiece) * demandQty;
    if (required > 0) {
      requiredByMaterial.set(item.materialId, (requiredByMaterial.get(item.materialId) ?? 0) + required);
    }
  });

  const items = materials
    .map((material) => {
      const required = Math.round((requiredByMaterial.get(material.id) ?? 0) * 100) / 100;
      const free = Math.round((Number(material.stockQty) - Number(material.allocatedQty)) * 100) / 100;
      const shortage = Math.max(0, Math.round((required - free) * 100) / 100);
      return {
        materialId: material.id,
        sku: material.sku,
        material: material.name,
        supplier: material.supplier?.name ?? "Unassigned",
        required,
        free,
        shortage,
      };
    })
    .filter((item) => item.required > 0 || item.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage);

  return res.json({ items });
});

export default router;
