import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../audit.mjs";
import { prisma } from "../db.mjs";
import { ApiError, asyncHandler, fail, ok } from "../http.mjs";

const router = Router();

const querySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  brandId: z.string().optional(),
  styleId: z.string().optional(),
});

const sizeAllocationSchema = z.object({
  sizeLabel: z.string().min(1),
  percent: z.coerce.number().int().min(0).max(100),
});

const colorAllocationSchema = z.object({
  colorName: z.string().min(1),
  hexCode: z.string().optional().nullable(),
  percent: z.coerce.number().int().min(0).max(100),
});

const createOrderSchema = z.object({
  brandId: z.string().min(1),
  styleId: z.string().min(1),
  poNumber: z.string().min(3),
  seasonCode: z.string().min(2),
  quantity: z.coerce.number().int().positive(),
  dueDate: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  notes: z.string().optional().default(""),
  sizeAllocations: z.array(sizeAllocationSchema).optional(),
  colorAllocations: z.array(colorAllocationSchema).optional(),
});

const updateOrderSchema = createOrderSchema.extend({
  status: z.enum(["CREATED", "PLANNED", "IN_PRODUCTION", "QA", "READY_TO_DISPATCH", "DISPATCHED", "DELAYED"]).optional(),
});

function mapStatus(status) {
  if (status === "QA") return "QA";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapOrder(order) {
  const progress = order.status === "DISPATCHED"
    ? 100
    : Math.min(100, Math.round((order.deliveredQty / Math.max(1, order.quantity)) * 100));

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
    progress,
  };
}

export function normaliseOrderInput(data) {
  return {
    ...data,
    poNumber: data.poNumber.trim().toUpperCase(),
    seasonCode: data.seasonCode.trim().toUpperCase(),
    notes: data.notes?.trim() ?? "",
  };
}

function isValidDateInput(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function buildDefaultSizeAllocations(styleSizes) {
  if (!styleSizes.length) return [];
  const base = Math.floor(100 / styleSizes.length);
  let remaining = 100;

  return styleSizes.map((size, index) => {
    const percent = index === styleSizes.length - 1 ? remaining : base;
    remaining -= percent;
    return {
      sizeLabel: size.label,
      percent,
    };
  });
}

export function buildDefaultColorAllocations(styleColors) {
  if (!styleColors.length) return [];
  const base = Math.floor(100 / styleColors.length);
  let remaining = 100;

  return styleColors.map((color, index) => {
    const percent = index === styleColors.length - 1 ? remaining : base;
    remaining -= percent;
    return {
      colorName: color.name,
      hexCode: color.hexCode,
      percent,
    };
  });
}

export function validateAllocationTotal(items, fieldName) {
  if (!items?.length) return;
  const total = items.reduce((sum, item) => sum + item.percent, 0);
  if (total !== 100) {
    throw new ApiError(400, `${fieldName} must total 100%`, "INVALID_ALLOCATION_TOTAL", {
      field: fieldName,
      total,
    });
  }
}

function validateLifecycle(existing, nextStatus, quantity) {
  if (!nextStatus) return;
  if (quantity < existing.deliveredQty) {
    throw new ApiError(409, "Order quantity cannot be lower than already delivered quantity", "INVALID_ORDER_QUANTITY");
  }
  if (nextStatus === "DISPATCHED" && existing.deliveredQty < quantity) {
    throw new ApiError(409, "Orders can only be marked dispatched once delivered quantity matches the order quantity", "INVALID_ORDER_STATUS");
  }
}

async function resolveOrderReferences(orderId, data) {
  const [brand, style] = await Promise.all([
    prisma.brand.findUnique({ where: { id: data.brandId } }),
    prisma.style.findUnique({
      where: { id: data.styleId },
      include: {
        sizes: { orderBy: { sortOrder: "asc" } },
        colors: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  if (!brand) {
    throw new ApiError(400, "Selected brand no longer exists", "BRAND_NOT_FOUND");
  }
  if (!style) {
    throw new ApiError(400, "Selected style no longer exists", "STYLE_NOT_FOUND");
  }
  if (style.brandId !== data.brandId) {
    throw new ApiError(400, "Selected style does not belong to the selected brand", "STYLE_BRAND_MISMATCH");
  }

  const sizeAllocations = data.sizeAllocations?.length
    ? data.sizeAllocations
    : buildDefaultSizeAllocations(style.sizes);
  const colorAllocations = data.colorAllocations?.length
    ? data.colorAllocations
    : buildDefaultColorAllocations(style.colors);

  validateAllocationTotal(sizeAllocations, "Size allocation");
  validateAllocationTotal(colorAllocations, "Color allocation");

  return { brand, style, sizeAllocations, colorAllocations };
}

router.get("/", asyncHandler(async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return fail(res, 400, "Invalid order filters", "INVALID_ORDER_FILTERS", parsed.error.flatten());
  }

  const q = parsed.data.q?.trim();
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      brandId: parsed.data.brandId || undefined,
      styleId: parsed.data.styleId || undefined,
      status: parsed.data.status
        ? parsed.data.status.toUpperCase().replaceAll(" ", "_")
        : undefined,
      OR: q
        ? [
            { poNumber: { contains: q, mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
            { style: { name: { contains: q, mode: "insensitive" } } },
            { style: { code: { contains: q, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: {
      brand: true,
      style: true,
    },
    orderBy: { dueDate: "asc" },
  });

  return ok(res, { items: orders.map(mapOrder) });
}));

router.get("/options", asyncHandler(async (_req, res) => {
  const [brands, styles] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.style.findMany({
      orderBy: { code: "asc" },
      include: {
        sizes: { orderBy: { sortOrder: "asc" } },
        colors: { orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  return ok(res, {
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
  });
}));

router.post("/", asyncHandler(async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid order payload", "INVALID_ORDER_PAYLOAD", parsed.error.flatten());
  }

  const data = normaliseOrderInput(parsed.data);
  if (!isValidDateInput(data.dueDate)) {
    return fail(res, 400, "Invalid delivery date", "INVALID_DUE_DATE");
  }

  const existingOrder = await prisma.purchaseOrder.findUnique({ where: { poNumber: data.poNumber } });
  if (existingOrder) {
    return fail(res, 409, "PO number already exists", "DUPLICATE_PO_NUMBER");
  }

  const { sizeAllocations, colorAllocations } = await resolveOrderReferences(null, data);

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
      data: {
        poNumber: data.poNumber,
        brandId: data.brandId,
        styleId: data.styleId,
        seasonCode: data.seasonCode,
        quantity: data.quantity,
        deliveredQty: 0,
        dueDate: new Date(data.dueDate),
        priority: data.priority,
        notes: data.notes,
        status: "CREATED",
        sizeAllocations: {
          create: sizeAllocations,
        },
        colorAllocations: {
          create: colorAllocations,
        },
      },
      include: {
        brand: true,
        style: true,
      },
    });

    await writeAuditLog(req, {
      tx,
      module: "orders",
      action: "CREATE",
      targetType: "PurchaseOrder",
      targetId: order.id,
      targetLabel: order.poNumber,
    });

    return order;
  });

  return res.status(201).json({ item: mapOrder(created) });
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid order payload", "INVALID_ORDER_PAYLOAD", parsed.error.flatten());
  }

  const data = normaliseOrderInput(parsed.data);
  if (!isValidDateInput(data.dueDate)) {
    return fail(res, 400, "Invalid delivery date", "INVALID_DUE_DATE");
  }

  const existing = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: {
      brand: true,
      style: true,
    },
  });
  if (!existing) {
    return fail(res, 404, "Order not found", "ORDER_NOT_FOUND");
  }

  const duplicateOrder = await prisma.purchaseOrder.findFirst({
    where: {
      poNumber: data.poNumber,
      id: { not: req.params.id },
    },
  });
  if (duplicateOrder) {
    return fail(res, 409, "PO number already exists", "DUPLICATE_PO_NUMBER");
  }

  validateLifecycle(existing, data.status, data.quantity);
  const { sizeAllocations, colorAllocations } = await resolveOrderReferences(req.params.id, data);

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        poNumber: data.poNumber,
        brandId: data.brandId,
        styleId: data.styleId,
        seasonCode: data.seasonCode,
        quantity: data.quantity,
        dueDate: new Date(data.dueDate),
        priority: data.priority,
        notes: data.notes,
        ...(data.status ? { status: data.status } : {}),
      },
      include: {
        brand: true,
        style: true,
      },
    });

    await tx.purchaseOrderSizeAllocation.deleteMany({ where: { orderId: order.id } });
    await tx.purchaseOrderColorAllocation.deleteMany({ where: { orderId: order.id } });
    await tx.purchaseOrderSizeAllocation.createMany({
      data: sizeAllocations.map((item) => ({ orderId: order.id, ...item })),
    });
    await tx.purchaseOrderColorAllocation.createMany({
      data: colorAllocations.map((item) => ({ orderId: order.id, ...item })),
    });

    await writeAuditLog(req, {
      tx,
      module: "orders",
      action: "UPDATE",
      targetType: "PurchaseOrder",
      targetId: order.id,
      targetLabel: order.poNumber,
    });

    return order;
  });

  return ok(res, { item: mapOrder(updated) });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: {
      productionPlans: { select: { id: true } },
      challans: { select: { id: true } },
      qaInspections: { select: { id: true } },
      shipments: { select: { id: true } },
    },
  });

  if (!order) {
    return fail(res, 404, "Order not found", "ORDER_NOT_FOUND");
  }

  if (order.productionPlans.length || order.challans.length || order.qaInspections.length || order.shipments.length) {
    return fail(res, 409, "Order cannot be deleted once execution records exist", "ORDER_HAS_EXECUTION_RECORDS");
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.delete({ where: { id: req.params.id } });
    await writeAuditLog(req, {
      tx,
      module: "orders",
      action: "DELETE",
      targetType: "PurchaseOrder",
      targetId: order.id,
      targetLabel: order.poNumber,
    });
  });

  return res.status(204).send();
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: {
      brand: true,
      style: {
        include: {
          sizes: { orderBy: { sortOrder: "asc" } },
          colors: { orderBy: { sortOrder: "asc" } },
          bomItems: {
            include: { material: { include: { supplier: true } } },
          },
        },
      },
      colorAllocations: true,
      sizeAllocations: true,
      challans: {
        include: { vendor: true },
        orderBy: { challanDate: "asc" },
      },
    },
  });

  if (!order) {
    return fail(res, 404, "Order not found", "ORDER_NOT_FOUND");
  }

  return ok(res, {
    item: mapOrder(order),
    bom: order.style.bomItems.map((item) => ({
      id: item.id,
      item: item.material.name,
      type: mapStatus(item.material.type),
      qty: Number(item.quantityPerPiece),
      uom: item.uom,
      supplier: item.material.supplier?.name ?? null,
    })),
    sizes: (order.sizeAllocations.length ? order.sizeAllocations : order.style.sizes).map((size, index) => ({
      size: size.sizeLabel ?? size.label,
      qty: size.percent ?? [8, 18, 28, 26, 14, 6][index] ?? 10,
    })),
    colors: (order.colorAllocations.length ? order.colorAllocations : order.style.colors).map((color, index) => ({
      color: color.colorName ?? color.name,
      hex: color.hexCode,
      qty: color.percent ?? [32, 28, 22, 18][index] ?? 20,
    })),
    challans: order.challans.map((challan) => ({
      id: challan.id,
      challanNumber: challan.challanNumber,
      date: challan.challanDate.toISOString().slice(0, 10),
      vendor: challan.vendor.name,
      process: challan.process,
      po: order.poNumber,
      outQty: challan.outwardQty,
      inQty: challan.inwardQty,
      rejected: challan.rejectedQty,
      status: mapStatus(challan.status),
    })),
  });
}));

export default router;
