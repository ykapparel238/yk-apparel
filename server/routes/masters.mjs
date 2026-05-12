import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../audit.mjs";
import { prisma } from "../db.mjs";
import { asyncHandler, fail, ok } from "../http.mjs";
import { deleteAssetBinary } from "../storage.mjs";
import { mapFileAsset, mapStyleTechPack, styleTechPackInclude } from "../style-tech-pack.mjs";

const router = Router();

const brandSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  countryCode: z.string().min(2).max(2),
});

const supplierSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  defaultMaterial: z.string().min(2),
  leadTimeDays: z.coerce.number().int().min(0),
});

const vendorSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  process: z.string().min(2),
  capacityPerDay: z.coerce.number().int().positive(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

const styleSchema = z.object({
  code: z.string().min(3),
  brandId: z.string().min(1),
  name: z.string().min(2),
  gauge: z.string().min(2),
  yarnDescription: z.string().min(2),
  sizes: z.array(z.string().min(1)).min(1),
  colors: z.array(z.object({
    name: z.string().min(1),
    hexCode: z.string().optional().nullable(),
    pantoneCode: z.string().optional().nullable(),
    threadCode: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).min(1),
});

const techPackPatchSchema = z.object({
  measurements: z.array(z.object({
    sizeLabel: z.string().min(1),
    measurementPoint: z.string().min(1),
    targetValue: z.coerce.number(),
    tolerancePlus: z.coerce.number().min(0).default(0),
    toleranceMinus: z.coerce.number().min(0).default(0),
    unit: z.string().min(1),
  })).default([]),
  threadSpecs: z.array(z.object({
    materialName: z.string().min(1),
    countSpec: z.string().min(1),
    colorRef: z.string().optional().nullable(),
    supplierId: z.string().optional().nullable(),
    materialId: z.string().optional().nullable(),
    processNotes: z.string().optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })).default([]),
  colorways: z.array(z.object({
    name: z.string().min(1),
    hexCode: z.string().optional().nullable(),
    pantoneCode: z.string().optional().nullable(),
    threadCode: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).default([]),
});

const styleSampleSchema = z.object({
  sampleType: z.enum(["PROTO", "FIT", "SIZE_SET", "PP", "SHIPMENT"]),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REVISED"]).default("DRAFT"),
  notes: z.string().optional().nullable().default(""),
  assetIds: z.array(z.string().min(1)).default([]),
});

const attachAssetSchema = z.object({
  assetId: z.string().min(1),
  kind: z.enum(["SAMPLE_IMAGE", "REFERENCE_IMAGE", "TECH_PACK", "ATTACHMENT"]).optional(),
});

const materialSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  type: z.enum(["YARN", "TRIM", "LABEL", "PACKING", "OTHER"]),
  uom: z.string().min(1),
  stockQty: z.coerce.number().min(0),
  allocatedQty: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
  supplierId: z.string().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.allocatedQty > value.stockQty) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allocatedQty"],
      message: "Allocated quantity cannot exceed stock quantity",
    });
  }
});

const bomItemSchema = z.object({
  styleId: z.string().min(1),
  materialId: z.string().min(1),
  quantityPerPiece: z.coerce.number().positive(),
  uom: z.string().min(1),
});

const lineSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  process: z.string().min(2),
  gauge: z.string().min(1),
  machineCount: z.coerce.number().int().min(1),
  isActive: z.boolean(),
});

export function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function formatVendorStatus(status) {
  return status === "ACTIVE" ? "Active" : "Inactive";
}

export function mapMaterialType(value) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapStyle(style) {
  const sampleImage = style.assetSummary?.find((asset) => asset.kind === "SAMPLE_IMAGE");
  const latestSample = style.samples?.[0] ?? null;
  return {
    id: style.id,
    code: style.code,
    brand: style.brand.name,
    brandId: style.brandId,
    name: style.name,
    gauge: style.gauge,
    yarn: style.yarnDescription,
    sizes: style.sizes.map((size) => size.label),
    colors: style.colors.length,
    colorItems: style.colors.map((color) => ({
      name: color.name,
      hexCode: color.hexCode,
      pantoneCode: color.pantoneCode ?? "",
      threadCode: color.threadCode ?? "",
      notes: color.notes ?? "",
    })),
    sampleImageUrl: sampleImage ? `/uploads/${sampleImage.storagePath}` : null,
    assetCount: style.assetSummary?.length ?? 0,
    sampleStatus: latestSample?.status ?? null,
    measurementCount: style.measurementSpecs?.length ?? 0,
    threadSpecCount: style.threadSpecs?.length ?? 0,
  };
}

function mapMaterial(material) {
  return {
    id: material.id,
    sku: material.sku,
    name: material.name,
    type: mapMaterialType(material.type),
    uom: material.uom,
    stock: Number(material.stockQty),
    allocated: Number(material.allocatedQty),
    reorderLevel: Number(material.reorderLevel),
    supplier: material.supplier?.name ?? "Unassigned",
    supplierId: material.supplierId ?? null,
  };
}

function mapBomItem(item) {
  return {
    id: item.id,
    styleId: item.styleId,
    styleCode: item.style.code,
    materialId: item.materialId,
    materialSku: item.material.sku,
    materialName: item.material.name,
    supplier: item.material.supplier?.name ?? null,
    qty: Number(item.quantityPerPiece),
    uom: item.uom,
  };
}

function mapLine(line) {
  return {
    id: line.id,
    code: line.code,
    name: line.name,
    process: line.process,
    gauge: line.gauge,
    machines: line.machineCount,
    active: line.isActive,
  };
}

async function getMastersPayload(search = "") {
  const q = search.trim();
  const [brands, suppliers, vendors, styles, styleAssets, orders, materials, bomItems, lines] = await Promise.all([
    prisma.brand.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { defaultMaterial: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { process: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      include: { challans: true, weeklyMetrics: true },
    }),
    prisma.style.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { yarnDescription: { contains: q, mode: "insensitive" } },
              { brand: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      orderBy: { code: "asc" },
      include: {
        brand: true,
        sizes: { orderBy: { sortOrder: "asc" } },
        colors: { orderBy: { sortOrder: "asc" } },
        samples: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        measurementSpecs: { select: { id: true } },
        threadSpecs: { select: { id: true } },
      },
    }),
    prisma.fileAsset.findMany({
      where: { entityType: "STYLE" },
      select: { entityId: true, kind: true, storagePath: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseOrder.findMany({ select: { brandId: true, styleId: true } }),
    prisma.material.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { supplier: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      orderBy: { sku: "asc" },
      include: { supplier: true },
    }),
    prisma.billOfMaterialItem.findMany({
      where: q
        ? {
            OR: [
              { style: { code: { contains: q, mode: "insensitive" } } },
              { material: { sku: { contains: q, mode: "insensitive" } } },
              { material: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      orderBy: [{ style: { code: "asc" } }, { material: { sku: "asc" } }],
      include: { style: true, material: { include: { supplier: true } } },
    }),
    prisma.productionLine.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { process: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    }),
  ]);

  const activeOrdersByBrand = new Map();
  const stylesInUse = new Set();
  const assetSummaryByStyle = new Map();
  orders.forEach((order) => {
    activeOrdersByBrand.set(order.brandId, (activeOrdersByBrand.get(order.brandId) ?? 0) + 1);
    stylesInUse.add(order.styleId);
  });
  styleAssets.forEach((asset) => {
    const current = assetSummaryByStyle.get(asset.entityId) ?? [];
    current.push(asset);
    assetSummaryByStyle.set(asset.entityId, current);
  });

  return {
    brands: brands.map((brand) => ({
      id: brand.id,
      code: brand.code,
      name: brand.name,
      country: brand.countryCode,
      activeOrders: activeOrdersByBrand.get(brand.id) ?? 0,
    })),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      code: supplier.code,
      name: supplier.name,
      material: supplier.defaultMaterial ?? "General",
      lead: supplier.leadTimeDays ?? 0,
    })),
    vendors: vendors.map((vendor) => {
      const pending = vendor.challans.reduce((sum, challan) => sum + Math.max(0, challan.outwardQty - challan.inwardQty), 0);
      return {
        id: vendor.id,
        code: vendor.code,
        name: vendor.name,
        process: vendor.process,
        capacity: vendor.capacityPerDay,
        pending,
        otd: average(vendor.weeklyMetrics.map((item) => item.onTimePct)),
        quality: average(vendor.weeklyMetrics.map((item) => item.qualityPct)),
        status: formatVendorStatus(vendor.status),
      };
    }),
    styles: styles.map((style) => ({
      ...mapStyle({
        ...style,
        assetSummary: assetSummaryByStyle.get(style.id) ?? [],
      }),
      inUse: stylesInUse.has(style.id),
    })),
    materials: materials.map(mapMaterial),
    bomItems: bomItems.map(mapBomItem),
    lines: lines.map(mapLine),
  };
}

async function fetchStyleTechPackById(styleId) {
  const [style, assets] = await Promise.all([
    prisma.style.findUnique({
      where: { id: styleId },
      include: styleTechPackInclude,
    }),
    prisma.fileAsset.findMany({
      where: { entityType: "STYLE", entityId: styleId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!style) {
    throw new Error("STYLE_NOT_FOUND");
  }

  return mapStyleTechPack(style, assets);
}

async function writeMasterAudit(req, tx, action, targetType, targetId, targetLabel) {
  await writeAuditLog(req, {
    tx,
    module: "masters",
    action,
    targetType,
    targetId,
    targetLabel,
  });
}

router.get("/summary", asyncHandler(async (req, res) => {
  return ok(res, await getMastersPayload(String(req.query.q || "")));
}));

router.get("/options", asyncHandler(async (_req, res) => {
  const [brands, suppliers, styles, materials] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.style.findMany({ orderBy: { code: "asc" } }),
    prisma.material.findMany({ orderBy: { sku: "asc" } }),
  ]);

  return ok(res, {
    brands: brands.map((brand) => ({ id: brand.id, name: brand.name, code: brand.code })),
    suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name, code: supplier.code })),
    styles: styles.map((style) => ({ id: style.id, code: style.code, name: style.name, brandId: style.brandId })),
    materials: materials.map((material) => ({
      id: material.id,
      sku: material.sku,
      name: material.name,
      supplierId: material.supplierId ?? null,
    })),
  });
}));

router.post("/brands", asyncHandler(async (req, res) => {
  const parsed = brandSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid brand payload", "INVALID_BRAND_PAYLOAD", parsed.error.flatten());
  const brand = await prisma.$transaction(async (tx) => {
    const item = await tx.brand.create({ data: parsed.data });
    await writeMasterAudit(req, tx, "CREATE", "Brand", item.id, item.name);
    return item;
  });
  return ok(res, { item: { id: brand.id, code: brand.code, name: brand.name, country: brand.countryCode, activeOrders: 0 } }, 201);
}));

router.patch("/brands/:id", asyncHandler(async (req, res) => {
  const parsed = brandSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid brand payload", "INVALID_BRAND_PAYLOAD", parsed.error.flatten());
  const brand = await prisma.$transaction(async (tx) => {
    const item = await tx.brand.update({ where: { id: req.params.id }, data: parsed.data });
    await writeMasterAudit(req, tx, "UPDATE", "Brand", item.id, item.name);
    return item;
  });
  return ok(res, { item: { id: brand.id, code: brand.code, name: brand.name, country: brand.countryCode } });
}));

router.delete("/brands/:id", asyncHandler(async (req, res) => {
  const [ordersCount, brand] = await Promise.all([
    prisma.purchaseOrder.count({ where: { brandId: req.params.id } }),
    prisma.brand.findUnique({ where: { id: req.params.id } }),
  ]);
  if (!brand) return fail(res, 404, "Brand not found", "BRAND_NOT_FOUND");
  if (ordersCount > 0) return fail(res, 409, "Brand cannot be deleted while orders exist", "BRAND_IN_USE");
  await prisma.$transaction(async (tx) => {
    await tx.brand.delete({ where: { id: req.params.id } });
    await writeMasterAudit(req, tx, "DELETE", "Brand", brand.id, brand.name);
  });
  return res.status(204).send();
}));

router.post("/suppliers", asyncHandler(async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid supplier payload", "INVALID_SUPPLIER_PAYLOAD", parsed.error.flatten());
  const supplier = await prisma.$transaction(async (tx) => {
    const item = await tx.supplier.create({ data: parsed.data });
    await writeMasterAudit(req, tx, "CREATE", "Supplier", item.id, item.name);
    return item;
  });
  return ok(res, { item: { id: supplier.id, code: supplier.code, name: supplier.name, material: supplier.defaultMaterial, lead: supplier.leadTimeDays ?? 0 } }, 201);
}));

router.patch("/suppliers/:id", asyncHandler(async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid supplier payload", "INVALID_SUPPLIER_PAYLOAD", parsed.error.flatten());
  const supplier = await prisma.$transaction(async (tx) => {
    const item = await tx.supplier.update({ where: { id: req.params.id }, data: parsed.data });
    await writeMasterAudit(req, tx, "UPDATE", "Supplier", item.id, item.name);
    return item;
  });
  return ok(res, { item: { id: supplier.id, code: supplier.code, name: supplier.name, material: supplier.defaultMaterial, lead: supplier.leadTimeDays ?? 0 } });
}));

router.delete("/suppliers/:id", asyncHandler(async (req, res) => {
  const [materialsCount, supplier] = await Promise.all([
    prisma.material.count({ where: { supplierId: req.params.id } }),
    prisma.supplier.findUnique({ where: { id: req.params.id } }),
  ]);
  if (!supplier) return fail(res, 404, "Supplier not found", "SUPPLIER_NOT_FOUND");
  if (materialsCount > 0) return fail(res, 409, "Supplier cannot be deleted while materials reference it", "SUPPLIER_IN_USE");
  await prisma.$transaction(async (tx) => {
    await tx.supplier.delete({ where: { id: req.params.id } });
    await writeMasterAudit(req, tx, "DELETE", "Supplier", supplier.id, supplier.name);
  });
  return res.status(204).send();
}));

router.post("/vendors", asyncHandler(async (req, res) => {
  const parsed = vendorSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid vendor payload", "INVALID_VENDOR_PAYLOAD", parsed.error.flatten());
  const vendor = await prisma.$transaction(async (tx) => {
    const item = await tx.vendor.create({ data: parsed.data });
    await writeMasterAudit(req, tx, "CREATE", "Vendor", item.id, item.name);
    return item;
  });
  return ok(res, { item: { id: vendor.id, code: vendor.code, name: vendor.name, process: vendor.process, capacity: vendor.capacityPerDay, pending: 0, otd: 0, quality: 0, status: formatVendorStatus(vendor.status) } }, 201);
}));

router.patch("/vendors/:id", asyncHandler(async (req, res) => {
  const parsed = vendorSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid vendor payload", "INVALID_VENDOR_PAYLOAD", parsed.error.flatten());
  const vendor = await prisma.$transaction(async (tx) => {
    const item = await tx.vendor.update({ where: { id: req.params.id }, data: parsed.data });
    await writeMasterAudit(req, tx, "UPDATE", "Vendor", item.id, item.name);
    return item;
  });
  return ok(res, { item: { id: vendor.id, code: vendor.code, name: vendor.name, process: vendor.process, capacity: vendor.capacityPerDay, status: formatVendorStatus(vendor.status) } });
}));

router.delete("/vendors/:id", asyncHandler(async (req, res) => {
  const [challanCount, vendor] = await Promise.all([
    prisma.vendorChallan.count({ where: { vendorId: req.params.id } }),
    prisma.vendor.findUnique({ where: { id: req.params.id } }),
  ]);
  if (!vendor) return fail(res, 404, "Vendor not found", "VENDOR_NOT_FOUND");
  if (challanCount > 0) return fail(res, 409, "Vendor cannot be deleted while challans exist", "VENDOR_IN_USE");
  await prisma.$transaction(async (tx) => {
    await tx.vendor.delete({ where: { id: req.params.id } });
    await writeMasterAudit(req, tx, "DELETE", "Vendor", vendor.id, vendor.name);
  });
  return res.status(204).send();
}));

router.post("/styles", asyncHandler(async (req, res) => {
  const parsed = styleSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid style payload", "INVALID_STYLE_PAYLOAD", parsed.error.flatten());
  const style = await prisma.$transaction(async (tx) => {
    const item = await tx.style.create({
      data: {
        code: parsed.data.code,
        brandId: parsed.data.brandId,
        name: parsed.data.name,
        gauge: parsed.data.gauge,
        yarnDescription: parsed.data.yarnDescription,
        sizes: { create: parsed.data.sizes.map((size, index) => ({ label: size, sortOrder: index + 1 })) },
        colors: {
          create: parsed.data.colors.map((color, index) => ({
            name: color.name,
            hexCode: color.hexCode || null,
            pantoneCode: color.pantoneCode || null,
            threadCode: color.threadCode || null,
            notes: color.notes || null,
            sortOrder: index + 1,
          })),
        },
      },
      include: {
        brand: true,
        sizes: { orderBy: { sortOrder: "asc" } },
        colors: { orderBy: { sortOrder: "asc" } },
        samples: { orderBy: { createdAt: "desc" }, take: 1 },
        measurementSpecs: { select: { id: true } },
        threadSpecs: { select: { id: true } },
      },
    });
    await writeMasterAudit(req, tx, "CREATE", "Style", item.id, item.code);
    return item;
  });
  return ok(res, { item: mapStyle(style) }, 201);
}));

router.patch("/styles/:id", asyncHandler(async (req, res) => {
  const parsed = styleSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid style payload", "INVALID_STYLE_PAYLOAD", parsed.error.flatten());
  const style = await prisma.$transaction(async (tx) => {
    await tx.styleSize.deleteMany({ where: { styleId: req.params.id } });
    await tx.styleColor.deleteMany({ where: { styleId: req.params.id } });
    const item = await tx.style.update({
      where: { id: req.params.id },
      data: {
        code: parsed.data.code,
        brandId: parsed.data.brandId,
        name: parsed.data.name,
        gauge: parsed.data.gauge,
        yarnDescription: parsed.data.yarnDescription,
        sizes: { create: parsed.data.sizes.map((size, index) => ({ label: size, sortOrder: index + 1 })) },
        colors: {
          create: parsed.data.colors.map((color, index) => ({
            name: color.name,
            hexCode: color.hexCode || null,
            pantoneCode: color.pantoneCode || null,
            threadCode: color.threadCode || null,
            notes: color.notes || null,
            sortOrder: index + 1,
          })),
        },
      },
      include: {
        brand: true,
        sizes: { orderBy: { sortOrder: "asc" } },
        colors: { orderBy: { sortOrder: "asc" } },
        samples: { orderBy: { createdAt: "desc" }, take: 1 },
        measurementSpecs: { select: { id: true } },
        threadSpecs: { select: { id: true } },
      },
    });
    await writeMasterAudit(req, tx, "UPDATE", "Style", item.id, item.code);
    return item;
  });
  return ok(res, { item: mapStyle(style) });
}));

router.delete("/styles/:id", asyncHandler(async (req, res) => {
  const [orderCount, style] = await Promise.all([
    prisma.purchaseOrder.count({ where: { styleId: req.params.id } }),
    prisma.style.findUnique({ where: { id: req.params.id } }),
  ]);
  if (!style) return fail(res, 404, "Style not found", "STYLE_NOT_FOUND");
  if (orderCount > 0) return fail(res, 409, "Style cannot be deleted while orders exist", "STYLE_IN_USE");
  await prisma.$transaction(async (tx) => {
    await tx.style.delete({ where: { id: req.params.id } });
    await writeMasterAudit(req, tx, "DELETE", "Style", style.id, style.code);
  });
  return res.status(204).send();
}));

router.get("/styles/:id/tech-pack", asyncHandler(async (req, res) => {
  const style = await prisma.style.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!style) {
    return fail(res, 404, "Style not found", "STYLE_NOT_FOUND");
  }

  return ok(res, await fetchStyleTechPackById(req.params.id));
}));

router.patch("/styles/:id/tech-pack", asyncHandler(async (req, res) => {
  const parsed = techPackPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid tech pack payload", "INVALID_TECH_PACK_PAYLOAD", parsed.error.flatten());
  }

  const style = await prisma.style.findUnique({ where: { id: req.params.id } });
  if (!style) {
    return fail(res, 404, "Style not found", "STYLE_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.styleMeasurementSpec.deleteMany({ where: { styleId: style.id } });
    await tx.styleThreadSpec.deleteMany({ where: { styleId: style.id } });

    if (parsed.data.measurements.length) {
      await tx.styleMeasurementSpec.createMany({
        data: parsed.data.measurements.map((item) => ({
          styleId: style.id,
          sizeLabel: item.sizeLabel,
          measurementPoint: item.measurementPoint,
          targetValue: item.targetValue.toFixed(2),
          tolerancePlus: item.tolerancePlus.toFixed(2),
          toleranceMinus: item.toleranceMinus.toFixed(2),
          unit: item.unit,
        })),
      });
    }

    if (parsed.data.threadSpecs.length) {
      await tx.styleThreadSpec.createMany({
        data: parsed.data.threadSpecs.map((item, index) => ({
          styleId: style.id,
          materialName: item.materialName,
          countSpec: item.countSpec,
          colorRef: item.colorRef || null,
          supplierId: item.supplierId || null,
          materialId: item.materialId || null,
          processNotes: item.processNotes || null,
          sortOrder: item.sortOrder ?? index + 1,
        })),
      });
    }

    await tx.styleColor.deleteMany({
      where: {
        styleId: style.id,
        name: {
          notIn: parsed.data.colorways.map((color) => color.name),
        },
      },
    });

    await Promise.all(parsed.data.colorways.map((color, index) =>
      tx.styleColor.upsert({
        where: { styleId_name: { styleId: style.id, name: color.name } },
        update: {
          hexCode: color.hexCode || null,
          pantoneCode: color.pantoneCode || null,
          threadCode: color.threadCode || null,
          notes: color.notes || null,
          sortOrder: index + 1,
        },
        create: {
          styleId: style.id,
          name: color.name,
          hexCode: color.hexCode || null,
          pantoneCode: color.pantoneCode || null,
          threadCode: color.threadCode || null,
          notes: color.notes || null,
          sortOrder: index + 1,
        },
      }),
    ));

    await writeMasterAudit(req, tx, "UPDATE", "StyleTechPack", style.id, style.code);
  });

  return ok(res, await fetchStyleTechPackById(style.id));
}));

router.post("/styles/:id/samples", asyncHandler(async (req, res) => {
  const parsed = styleSampleSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid sample payload", "INVALID_STYLE_SAMPLE_PAYLOAD", parsed.error.flatten());
  }

  const style = await prisma.style.findUnique({ where: { id: req.params.id } });
  if (!style) {
    return fail(res, 404, "Style not found", "STYLE_NOT_FOUND");
  }

  const sample = await prisma.$transaction(async (tx) => {
    const created = await tx.styleSample.create({
      data: {
        styleId: style.id,
        sampleType: parsed.data.sampleType,
        status: parsed.data.status,
        notes: parsed.data.notes || "",
        approvedByUserId: parsed.data.status === "APPROVED" ? req.sessionUser?.id ?? null : null,
        approvedAt: parsed.data.status === "APPROVED" ? new Date() : null,
      },
    });

    if (parsed.data.assetIds.length) {
      await tx.styleSampleAsset.createMany({
        data: parsed.data.assetIds.map((assetId) => ({ sampleId: created.id, assetId })),
      });
    }

    await writeMasterAudit(req, tx, "CREATE", "StyleSample", created.id, `${style.code} ${parsed.data.sampleType}`);
    return created;
  });

  return ok(res, { item: (await fetchStyleTechPackById(style.id)).samples.find((item) => item.id === sample.id) }, 201);
}));

router.patch("/styles/:id/samples/:sampleId", asyncHandler(async (req, res) => {
  const parsed = styleSampleSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid sample payload", "INVALID_STYLE_SAMPLE_PAYLOAD", parsed.error.flatten());
  }

  const sample = await prisma.styleSample.findUnique({ where: { id: req.params.sampleId } });
  if (!sample || sample.styleId !== req.params.id) {
    return fail(res, 404, "Style sample not found", "STYLE_SAMPLE_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.styleSample.update({
      where: { id: sample.id },
      data: {
        sampleType: parsed.data.sampleType,
        status: parsed.data.status,
        notes: parsed.data.notes || "",
        approvedByUserId: parsed.data.status === "APPROVED" ? req.sessionUser?.id ?? null : null,
        approvedAt: parsed.data.status === "APPROVED" ? new Date() : null,
      },
    });
    await tx.styleSampleAsset.deleteMany({ where: { sampleId: sample.id } });
    if (parsed.data.assetIds.length) {
      await tx.styleSampleAsset.createMany({
        data: parsed.data.assetIds.map((assetId) => ({ sampleId: sample.id, assetId })),
      });
    }
    await writeMasterAudit(req, tx, "UPDATE", "StyleSample", sample.id, `${req.params.id} ${parsed.data.sampleType}`);
  });

  return ok(res, { item: (await fetchStyleTechPackById(req.params.id)).samples.find((item) => item.id === sample.id) });
}));

router.post("/styles/:id/assets", asyncHandler(async (req, res) => {
  const parsed = attachAssetSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid style asset payload", "INVALID_STYLE_ASSET_PAYLOAD", parsed.error.flatten());
  }

  const [style, asset] = await Promise.all([
    prisma.style.findUnique({ where: { id: req.params.id } }),
    prisma.fileAsset.findUnique({ where: { id: parsed.data.assetId } }),
  ]);
  if (!style) return fail(res, 404, "Style not found", "STYLE_NOT_FOUND");
  if (!asset) return fail(res, 404, "Asset not found", "ASSET_NOT_FOUND");

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.fileAsset.update({
      where: { id: asset.id },
      data: {
        entityType: "STYLE",
        entityId: style.id,
        kind: parsed.data.kind ?? asset.kind,
      },
    });
    await writeMasterAudit(req, tx, "UPDATE", "FileAsset", item.id, item.originalName);
    return item;
  });

  return ok(res, { item: mapFileAsset(updated) });
}));

router.delete("/styles/:id/assets/:assetId", asyncHandler(async (req, res) => {
  const asset = await prisma.fileAsset.findUnique({ where: { id: req.params.assetId } });
  if (!asset || asset.entityType !== "STYLE" || asset.entityId !== req.params.id) {
    return fail(res, 404, "Asset not found", "ASSET_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.styleSampleAsset.deleteMany({ where: { assetId: asset.id } });
    await tx.fileAsset.delete({ where: { id: asset.id } });
    await writeMasterAudit(req, tx, "DELETE", "FileAsset", asset.id, asset.originalName);
  });
  await deleteAssetBinary(asset.storagePath);

  return res.status(204).send();
}));

router.post("/materials", asyncHandler(async (req, res) => {
  const parsed = materialSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid material payload", "INVALID_MATERIAL_PAYLOAD", parsed.error.flatten());
  const material = await prisma.$transaction(async (tx) => {
    const item = await tx.material.create({
      data: {
        sku: parsed.data.sku,
        name: parsed.data.name,
        type: parsed.data.type,
        uom: parsed.data.uom,
        stockQty: parsed.data.stockQty.toFixed(2),
        allocatedQty: parsed.data.allocatedQty.toFixed(2),
        reorderLevel: parsed.data.reorderLevel.toFixed(2),
        supplierId: parsed.data.supplierId || null,
      },
      include: { supplier: true },
    });
    await writeMasterAudit(req, tx, "CREATE", "Material", item.id, item.sku);
    return item;
  });
  return ok(res, { item: mapMaterial(material) }, 201);
}));

router.patch("/materials/:id", asyncHandler(async (req, res) => {
  const parsed = materialSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid material payload", "INVALID_MATERIAL_PAYLOAD", parsed.error.flatten());
  const material = await prisma.$transaction(async (tx) => {
    const item = await tx.material.update({
      where: { id: req.params.id },
      data: {
        sku: parsed.data.sku,
        name: parsed.data.name,
        type: parsed.data.type,
        uom: parsed.data.uom,
        stockQty: parsed.data.stockQty.toFixed(2),
        allocatedQty: parsed.data.allocatedQty.toFixed(2),
        reorderLevel: parsed.data.reorderLevel.toFixed(2),
        supplierId: parsed.data.supplierId || null,
      },
      include: { supplier: true },
    });
    await writeMasterAudit(req, tx, "UPDATE", "Material", item.id, item.sku);
    return item;
  });
  return ok(res, { item: mapMaterial(material) });
}));

router.delete("/materials/:id", asyncHandler(async (req, res) => {
  const [bomCount, material] = await Promise.all([
    prisma.billOfMaterialItem.count({ where: { materialId: req.params.id } }),
    prisma.material.findUnique({ where: { id: req.params.id } }),
  ]);
  if (!material) return fail(res, 404, "Material not found", "MATERIAL_NOT_FOUND");
  if (bomCount > 0) return fail(res, 409, "Material cannot be deleted while BOM items reference it", "MATERIAL_IN_USE");
  await prisma.$transaction(async (tx) => {
    await tx.material.delete({ where: { id: req.params.id } });
    await writeMasterAudit(req, tx, "DELETE", "Material", material.id, material.sku);
  });
  return res.status(204).send();
}));

router.post("/bom-items", asyncHandler(async (req, res) => {
  const parsed = bomItemSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid BOM payload", "INVALID_BOM_PAYLOAD", parsed.error.flatten());
  const duplicate = await prisma.billOfMaterialItem.findFirst({
    where: { styleId: parsed.data.styleId, materialId: parsed.data.materialId },
  });
  if (duplicate) return fail(res, 409, "This material is already in the selected style BOM", "DUPLICATE_BOM_ITEM");
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.billOfMaterialItem.create({
      data: {
        styleId: parsed.data.styleId,
        materialId: parsed.data.materialId,
        quantityPerPiece: parsed.data.quantityPerPiece.toFixed(2),
        uom: parsed.data.uom,
      },
      include: { style: true, material: { include: { supplier: true } } },
    });
    await writeMasterAudit(req, tx, "CREATE", "BillOfMaterialItem", created.id, `${created.style.code} / ${created.material.sku}`);
    return created;
  });
  return ok(res, { item: mapBomItem(item) }, 201);
}));

router.patch("/bom-items/:id", asyncHandler(async (req, res) => {
  const parsed = bomItemSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid BOM payload", "INVALID_BOM_PAYLOAD", parsed.error.flatten());
  const duplicate = await prisma.billOfMaterialItem.findFirst({
    where: { styleId: parsed.data.styleId, materialId: parsed.data.materialId, id: { not: req.params.id } },
  });
  if (duplicate) return fail(res, 409, "This material is already in the selected style BOM", "DUPLICATE_BOM_ITEM");
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.billOfMaterialItem.update({
      where: { id: req.params.id },
      data: {
        styleId: parsed.data.styleId,
        materialId: parsed.data.materialId,
        quantityPerPiece: parsed.data.quantityPerPiece.toFixed(2),
        uom: parsed.data.uom,
      },
      include: { style: true, material: { include: { supplier: true } } },
    });
    await writeMasterAudit(req, tx, "UPDATE", "BillOfMaterialItem", updated.id, `${updated.style.code} / ${updated.material.sku}`);
    return updated;
  });
  return ok(res, { item: mapBomItem(item) });
}));

router.delete("/bom-items/:id", asyncHandler(async (req, res) => {
  const item = await prisma.billOfMaterialItem.findUnique({
    where: { id: req.params.id },
    include: { style: true, material: true },
  });
  if (!item) return fail(res, 404, "BOM item not found", "BOM_ITEM_NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await tx.billOfMaterialItem.delete({ where: { id: req.params.id } });
    await writeMasterAudit(req, tx, "DELETE", "BillOfMaterialItem", item.id, `${item.style.code} / ${item.material.sku}`);
  });
  return res.status(204).send();
}));

router.post("/lines", asyncHandler(async (req, res) => {
  const parsed = lineSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid line payload", "INVALID_LINE_PAYLOAD", parsed.error.flatten());
  const line = await prisma.$transaction(async (tx) => {
    const item = await tx.productionLine.create({ data: parsed.data });
    await writeMasterAudit(req, tx, "CREATE", "ProductionLine", item.id, item.name);
    return item;
  });
  return ok(res, { item: mapLine(line) }, 201);
}));

router.patch("/lines/:id", asyncHandler(async (req, res) => {
  const parsed = lineSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Invalid line payload", "INVALID_LINE_PAYLOAD", parsed.error.flatten());
  const line = await prisma.$transaction(async (tx) => {
    const item = await tx.productionLine.update({ where: { id: req.params.id }, data: parsed.data });
    await writeMasterAudit(req, tx, "UPDATE", "ProductionLine", item.id, item.name);
    return item;
  });
  return ok(res, { item: mapLine(line) });
}));

router.delete("/lines/:id", asyncHandler(async (req, res) => {
  const [planCount, metricCount, inspectionCount, line] = await Promise.all([
    prisma.productionPlan.count({ where: { lineId: req.params.id } }),
    prisma.lineDailyMetric.count({ where: { lineId: req.params.id } }),
    prisma.qaInspection.count({ where: { lineId: req.params.id } }),
    prisma.productionLine.findUnique({ where: { id: req.params.id } }),
  ]);
  if (!line) return fail(res, 404, "Line not found", "LINE_NOT_FOUND");
  if (planCount > 0 || metricCount > 0 || inspectionCount > 0) {
    return fail(res, 409, "Line cannot be deleted while planning or execution records exist", "LINE_IN_USE");
  }
  await prisma.$transaction(async (tx) => {
    await tx.productionLine.delete({ where: { id: req.params.id } });
    await writeMasterAudit(req, tx, "DELETE", "ProductionLine", line.id, line.name);
  });
  return res.status(204).send();
}));

export default router;
