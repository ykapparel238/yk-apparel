import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, requireRoles, asyncHandler } from "../http.mjs";

const router = Router();

const shipmentSchema = z.object({
  orderId: z.string().min(1).optional(),
  dispatchDate: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  invoiceNumber: z.string().optional(),
});

function mapStatus(value) {
  if (value === "QA") return "QA";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapDispatchItem(order) {
  const latestShipment = order.shipments?.[0] ?? null;
  return {
    id: order.id,
    poNumber: order.poNumber,
    brand: order.brand.name,
    styleName: order.style.name,
    qty: order.quantity,
    dispatched: order.deliveredQty,
    due: order.dueDate.toISOString().slice(0, 10),
    status: mapStatus(order.status),
    latestShipment: latestShipment
      ? {
          id: latestShipment.id,
          dispatchDate: latestShipment.dispatchDate.toISOString().slice(0, 10),
          quantity: latestShipment.quantity,
          invoiceNumber: latestShipment.invoiceNumber ?? null,
        }
      : null,
  };
}

function deriveOrderStatus(totalDelivered, quantity) {
  return totalDelivered >= quantity ? "DISPATCHED" : "READY_TO_DISPATCH";
}

function deriveShipmentStatus(totalDelivered, quantity) {
  return totalDelivered >= quantity ? "DISPATCHED" : "SCHEDULED";
}

async function getDispatchOrder(orderId) {
  return prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: {
      brand: true,
      style: true,
      shipments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

router.get("/", asyncHandler(async (_req, res) => {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: ["QA", "READY_TO_DISPATCH", "DISPATCHED"],
      },
    },
    include: {
      brand: true,
      style: true,
      shipments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return ok(res, { items: orders.map(mapDispatchItem) });
}));

router.post("/shipments", requireRoles("ADMIN", "DISPATCH_MANAGER", "FACTORY_MANAGER"), asyncHandler(async (req, res) => {
  const parsed = shipmentSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.orderId) {
    return fail(res, 400, "Invalid shipment payload", "INVALID_SHIPMENT_PAYLOAD", parsed.success ? { orderId: ["Required"] } : parsed.error.flatten());
  }

  const dispatchDate = new Date(parsed.data.dispatchDate);
  if (Number.isNaN(dispatchDate.getTime())) {
    return fail(res, 400, "Invalid dispatch date", "INVALID_DISPATCH_DATE");
  }

  const order = await getDispatchOrder(parsed.data.orderId);
  if (!order) {
    return fail(res, 404, "Order not found", "ORDER_NOT_FOUND");
  }

  const remaining = Math.max(0, order.quantity - order.deliveredQty);
  if (parsed.data.quantity > remaining) {
    return fail(res, 409, `Dispatch quantity exceeds remaining balance (${remaining.toLocaleString("en-IN")})`, "OVER_DISPATCH");
  }

  const latest = await prisma.dispatchShipment.findFirst({
    orderBy: { createdAt: "desc" },
    select: { shipmentNumber: true },
  });
  const last = latest?.shipmentNumber?.match(/SHIP-(\d+)/)?.[1];
  const nextNumber = `SHIP-${last ? Number(last) + 1 : 2402}`;

  const deliveredQty = order.deliveredQty + parsed.data.quantity;
  await prisma.$transaction(async (tx) => {
    await tx.dispatchShipment.create({
      data: {
        shipmentNumber: nextNumber,
        orderId: order.id,
        dispatchDate,
        quantity: parsed.data.quantity,
        invoiceNumber: parsed.data.invoiceNumber?.trim() || null,
        status: deriveShipmentStatus(deliveredQty, order.quantity),
      },
    });
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        deliveredQty,
        status: deriveOrderStatus(deliveredQty, order.quantity),
      },
    });
  });

  const updatedOrder = await getDispatchOrder(order.id);

  await writeAuditLog(req, {
    module: "Dispatch",
    action: "Created shipment",
    targetType: "DispatchShipment",
    targetId: updatedOrder.shipments[0]?.id ?? null,
    targetLabel: updatedOrder.shipments[0]?.shipmentNumber ?? nextNumber,
  });

  return ok(res, { item: mapDispatchItem(updatedOrder) }, 201);
}));

router.patch("/shipments/:id", requireRoles("ADMIN", "DISPATCH_MANAGER", "FACTORY_MANAGER"), asyncHandler(async (req, res) => {
  const parsed = shipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid shipment payload", "INVALID_SHIPMENT_PAYLOAD", parsed.error.flatten());
  }

  const dispatchDate = new Date(parsed.data.dispatchDate);
  if (Number.isNaN(dispatchDate.getTime())) {
    return fail(res, 400, "Invalid dispatch date", "INVALID_DISPATCH_DATE");
  }

  const shipment = await prisma.dispatchShipment.findUnique({
    where: { id: req.params.id },
    include: {
      order: {
        include: {
          brand: true,
          style: true,
          shipments: true,
        },
      },
    },
  });
  if (!shipment) {
    return fail(res, 404, "Shipment not found", "SHIPMENT_NOT_FOUND");
  }

  const otherQty = shipment.order.shipments
    .filter((item) => item.id !== shipment.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const nextDeliveredQty = otherQty + parsed.data.quantity;

  if (nextDeliveredQty > shipment.order.quantity) {
    const remaining = Math.max(0, shipment.order.quantity - otherQty);
    return fail(res, 409, `Dispatch quantity exceeds remaining balance (${remaining.toLocaleString("en-IN")})`, "OVER_DISPATCH");
  }

  await prisma.$transaction(async (tx) => {
    await tx.dispatchShipment.update({
      where: { id: shipment.id },
      data: {
        dispatchDate,
        quantity: parsed.data.quantity,
        invoiceNumber: parsed.data.invoiceNumber?.trim() || null,
        status: deriveShipmentStatus(nextDeliveredQty, shipment.order.quantity),
      },
    });
    await tx.purchaseOrder.update({
      where: { id: shipment.orderId },
      data: {
        deliveredQty: nextDeliveredQty,
        status: deriveOrderStatus(nextDeliveredQty, shipment.order.quantity),
      },
    });
  });

  const updatedOrder = await getDispatchOrder(shipment.orderId);

  await writeAuditLog(req, {
    module: "Dispatch",
    action: "Updated shipment",
    targetType: "DispatchShipment",
    targetId: shipment.id,
    targetLabel: shipment.shipmentNumber,
  });

  return ok(res, { item: mapDispatchItem(updatedOrder) });
}));

export default router;
