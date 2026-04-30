import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, requireRoles, asyncHandler } from "../http.mjs";
import { ACTIVE_ORDER_STATUSES } from "../constants.mjs";

const router = Router();

const inspectionSchema = z.object({
  inspectedAt: z.string().min(1),
  orderId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  lineId: z.string().optional().nullable(),
  stage: z.enum(["YARN_INWARD", "KNITTING", "LINKING", "WASHING", "DRYING", "FINISHING", "IRONING", "QUALITY_CHECK", "PACKING", "DISPATCH"]),
  checkedQty: z.coerce.number().int().positive(),
  approvedQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
  reworkQty: z.coerce.number().int().min(0),
  defects: z.array(z.object({ defectTypeId: z.string().min(1), count: z.coerce.number().int().positive() })).default([]),
});

function mapStage(value) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => {
      if (part === "qa") return "QA";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function validateInspectionPayload(data) {
  const defectTotal = data.defects.reduce((sum, defect) => sum + defect.count, 0);
  if (data.approvedQty + data.rejectedQty > data.checkedQty) {
    return { status: 409, message: "Approved and rejected quantity cannot exceed checked quantity", code: "INVALID_QA_TOTALS" };
  }
  if (defectTotal > data.rejectedQty + data.reworkQty) {
    return { status: 409, message: "Defect count cannot exceed rejected and rework quantity", code: "INVALID_DEFECT_TOTALS" };
  }
  return null;
}

async function buildQaPayload() {
  const [inspections, vendors, defects, orders, lines, defectTypes] = await Promise.all([
    prisma.qaInspection.findMany({
      orderBy: { inspectedAt: "desc" },
      include: {
        order: { select: { id: true, poNumber: true } },
        vendor: { select: { id: true, name: true } },
        line: { select: { id: true, name: true } },
        defects: {
          include: { defectType: true },
        },
      },
    }),
    prisma.vendor.findMany({
      orderBy: { name: "asc" },
      include: {
        weeklyMetrics: true,
      },
    }),
    prisma.qaInspectionDefect.findMany({
      include: { defectType: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      orderBy: { poNumber: "asc" },
      select: { id: true, poNumber: true },
    }),
    prisma.productionLine.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.qaDefectType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const summary = inspections.reduce(
    (acc, inspection) => {
      acc.checked += inspection.checkedQty;
      acc.approved += inspection.approvedQty;
      acc.rejected += inspection.rejectedQty;
      acc.rework += inspection.reworkQty;
      return acc;
    },
    { checked: 0, approved: 0, rejected: 0, rework: 0 },
  );

  const groupedDefects = new Map();
  defects.forEach((defect) => {
    groupedDefects.set(
      defect.defectType.name,
      (groupedDefects.get(defect.defectType.name) ?? 0) + defect.count,
    );
  });
  const totalDefects = Array.from(groupedDefects.values()).reduce((sum, count) => sum + count, 0);

  return {
    summary,
    defects: Array.from(groupedDefects.entries())
      .map(([type, count]) => ({
        type,
        count,
        pct: totalDefects ? Math.round((count / totalDefects) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count),
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
    })),
    orderOptions: orders,
    lineOptions: lines,
    defectTypes,
  };
}

router.get("/", asyncHandler(async (_req, res) => {
  return ok(res, await buildQaPayload());
}));

router.post(
  "/inspections",
  requireRoles("ADMIN", "QA_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = inspectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid inspection payload", "INVALID_INSPECTION_PAYLOAD", parsed.error.flatten());
    }

    const inspectedAt = new Date(parsed.data.inspectedAt);
    if (Number.isNaN(inspectedAt.getTime())) {
      return fail(res, 400, "Invalid inspection date", "INVALID_INSPECTION_DATE");
    }
    const validationError = validateInspectionPayload(parsed.data);
    if (validationError) {
      return fail(res, validationError.status, validationError.message, validationError.code);
    }

    const inspection = await prisma.$transaction(async (tx) => {
      const created = await tx.qaInspection.create({
        data: {
          inspectedAt,
          orderId: parsed.data.orderId || null,
          vendorId: parsed.data.vendorId || null,
          lineId: parsed.data.lineId || null,
          stage: parsed.data.stage,
          checkedQty: parsed.data.checkedQty,
          approvedQty: parsed.data.approvedQty,
          rejectedQty: parsed.data.rejectedQty,
          reworkQty: parsed.data.reworkQty,
        },
      });

      if (parsed.data.defects.length) {
        await tx.qaInspectionDefect.createMany({
          data: parsed.data.defects.map((defect) => ({
            inspectionId: created.id,
            defectTypeId: defect.defectTypeId,
            count: defect.count,
          })),
        });
      }

      return created;
    });

    await writeAuditLog(req, {
      module: "QA",
      action: "Created inspection",
      targetType: "QaInspection",
      targetId: inspection.id,
      targetLabel: `Inspection ${inspection.id}`,
    });

    return ok(res, { item: { id: inspection.id } }, 201);
  }),
);

router.patch(
  "/inspections/:id",
  requireRoles("ADMIN", "QA_MANAGER"),
  asyncHandler(async (req, res) => {
    const parsed = inspectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid inspection payload", "INVALID_INSPECTION_PAYLOAD", parsed.error.flatten());
    }

    const inspectedAt = new Date(parsed.data.inspectedAt);
    if (Number.isNaN(inspectedAt.getTime())) {
      return fail(res, 400, "Invalid inspection date", "INVALID_INSPECTION_DATE");
    }
    const validationError = validateInspectionPayload(parsed.data);
    if (validationError) {
      return fail(res, validationError.status, validationError.message, validationError.code);
    }

    const existing = await prisma.qaInspection.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return fail(res, 404, "Inspection not found", "INSPECTION_NOT_FOUND");
    }

    const inspection = await prisma.$transaction(async (tx) => {
      const updated = await tx.qaInspection.update({
        where: { id: req.params.id },
        data: {
          inspectedAt,
          orderId: parsed.data.orderId || null,
          vendorId: parsed.data.vendorId || null,
          lineId: parsed.data.lineId || null,
          stage: parsed.data.stage,
          checkedQty: parsed.data.checkedQty,
          approvedQty: parsed.data.approvedQty,
          rejectedQty: parsed.data.rejectedQty,
          reworkQty: parsed.data.reworkQty,
        },
      });

      await tx.qaInspectionDefect.deleteMany({
        where: { inspectionId: updated.id },
      });
      if (parsed.data.defects.length) {
        await tx.qaInspectionDefect.createMany({
          data: parsed.data.defects.map((defect) => ({
            inspectionId: updated.id,
            defectTypeId: defect.defectTypeId,
            count: defect.count,
          })),
        });
      }

      return updated;
    });

    await writeAuditLog(req, {
      module: "QA",
      action: "Updated inspection",
      targetType: "QaInspection",
      targetId: inspection.id,
      targetLabel: `Inspection ${inspection.id}`,
    });

    return ok(res, { item: { id: inspection.id } });
  }),
);

export default router;
