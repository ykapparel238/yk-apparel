import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { asyncHandler, fail, ok, requireRoles } from "../http.mjs";
import { enforceWorkflowEditLimit, recordWorkflowEditLock } from "../workflow-control.mjs";

const router = Router();

const productionEntrySchema = z.object({
  metricDate: z.string().min(1),
  lineId: z.string().min(1),
  orderId: z.string().optional().nullable(),
  shiftId: z.string().optional().nullable(),
  stage: z.enum(["YARN_INWARD", "KNITTING", "LINKING", "WASHING", "DRYING", "FINISHING", "IRONING", "QUALITY_CHECK", "PACKING", "DISPATCH"]),
  plannedQty: z.coerce.number().int().min(0),
  actualQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
  downtimeMinutes: z.coerce.number().int().min(0),
  downtimeReasonId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

function mapStage(stage) {
  if (stage === "QA") return "QA";
  return stage
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapEntry(entry) {
  return {
    id: entry.id,
    metricDate: entry.metricDate.toISOString().slice(0, 10),
    lineId: entry.lineId,
    lineName: entry.line.name,
    orderId: entry.orderId ?? null,
    poNumber: entry.order?.poNumber ?? null,
    shiftId: entry.shiftId ?? null,
    shiftName: entry.shift?.name ?? null,
    stage: entry.stage,
    plannedQty: entry.plannedQty,
    actualQty: entry.actualQty,
    rejectedQty: entry.rejectedQty,
    downtimeMinutes: entry.downtimeMinutes,
    downtimeReasonId: entry.downtimeReasonId ?? null,
    downtimeReason: entry.downtimeReason?.label ?? null,
    remarks: entry.remarks ?? "",
  };
}

router.get("/stages", asyncHandler(async (_req, res) => {
  const latestEntryDate = await prisma.productionEntry.aggregate({ _max: { metricDate: true } });
  if (latestEntryDate._max.metricDate) {
    const entries = await prisma.productionEntry.findMany({
      where: { metricDate: latestEntryDate._max.metricDate },
    });
    const grouped = new Map();
    entries.forEach((entry) => {
      const current = grouped.get(entry.stage) ?? { planned: 0, actual: 0, rejected: 0 };
      current.planned += entry.plannedQty;
      current.actual += entry.actualQty;
      current.rejected += entry.rejectedQty;
      grouped.set(entry.stage, current);
    });
    return ok(res, {
      items: Array.from(grouped.entries()).map(([stage, metric]) => ({
        stage: mapStage(stage),
        planned: metric.planned,
        actual: metric.actual,
        wip: Math.max(0, metric.planned - metric.actual),
        rejected: metric.rejected,
        pending: Math.max(0, metric.planned - metric.actual),
      })),
    });
  }

  const latestMetricDate = await prisma.stageDailyMetric.aggregate({ _max: { metricDate: true } });
  const metrics = latestMetricDate._max.metricDate
    ? await prisma.stageDailyMetric.findMany({
        where: { metricDate: latestMetricDate._max.metricDate },
        orderBy: { metricDate: "asc" },
      })
    : [];

  return ok(res, {
    items: metrics.map((metric) => ({
      stage: mapStage(metric.stage),
      planned: metric.plannedQty,
      actual: metric.actualQty,
      wip: metric.wipQty,
      rejected: metric.rejectedQty,
      pending: metric.pendingQty,
    })),
  });
}));

router.get("/lines", asyncHandler(async (_req, res) => {
  const latestEntryDate = await prisma.productionEntry.aggregate({ _max: { metricDate: true } });
  const [lines, entryMetrics] = await Promise.all([
    prisma.productionLine.findMany({ orderBy: { name: "asc" } }),
    latestEntryDate._max.metricDate
      ? prisma.productionEntry.findMany({ where: { metricDate: latestEntryDate._max.metricDate } })
      : Promise.resolve([]),
  ]);

  if (entryMetrics.length) {
    const metricMap = new Map();
    entryMetrics.forEach((entry) => {
      const current = metricMap.get(entry.lineId) ?? { outputQty: 0, plannedQty: 0, rejectedQty: 0, downtimeMinutes: 0 };
      current.outputQty += entry.actualQty;
      current.plannedQty += entry.plannedQty;
      current.rejectedQty += entry.rejectedQty;
      current.downtimeMinutes += entry.downtimeMinutes;
      metricMap.set(entry.lineId, current);
    });

    return ok(res, {
      items: lines.map((line) => {
        const metric = metricMap.get(line.id);
        const efficiency = metric?.plannedQty ? Math.round((metric.outputQty / metric.plannedQty) * 100) : 0;
        return {
          id: line.id,
          name: line.name,
          gauge: line.gauge,
          machines: line.machineCount,
          output: metric?.outputQty ?? 0,
          efficiency,
          status: metric?.downtimeMinutes && metric.downtimeMinutes > 45 ? "Attention" : "Running",
        };
      }),
    });
  }

  const latestMetricDate = await prisma.lineDailyMetric.aggregate({ _max: { metricDate: true } });
  const [fallbackLines, metrics] = await Promise.all([
    prisma.productionLine.findMany({ orderBy: { name: "asc" } }),
    latestMetricDate._max.metricDate
      ? prisma.lineDailyMetric.findMany({ where: { metricDate: latestMetricDate._max.metricDate } })
      : Promise.resolve([]),
  ]);

  const metricMap = new Map(metrics.map((metric) => [metric.lineId, metric]));

  return ok(res, {
    items: fallbackLines.map((line) => {
      const metric = metricMap.get(line.id);
      return {
        id: line.id,
        name: line.name,
        gauge: line.gauge,
        machines: line.machineCount,
        output: metric?.outputQty ?? 0,
        efficiency: metric?.efficiencyPct ?? 0,
        status: metric?.isRunning ? "Running" : "Stopped",
      };
    }),
  });
}));

router.get("/entries", asyncHandler(async (_req, res) => {
  const [entries, downtimeReasons, shifts, orders, lines] = await Promise.all([
    prisma.productionEntry.findMany({
      include: {
        line: true,
        order: true,
        shift: true,
        downtimeReason: true,
      },
      orderBy: [{ metricDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.downtimeReason.findMany({ orderBy: { label: "asc" } }),
    prisma.shift.findMany({ orderBy: { name: "asc" } }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["PLANNED", "IN_PRODUCTION", "QA", "READY_TO_DISPATCH"] } },
      orderBy: { poNumber: "asc" },
      select: { id: true, poNumber: true },
    }),
    prisma.productionLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return ok(res, {
    items: entries.map(mapEntry),
    downtimeReasons: downtimeReasons.map((item) => ({ id: item.id, code: item.code, label: item.label })),
    shifts: shifts.map((item) => ({ id: item.id, name: item.name })),
    orders,
    lines,
  });
}));

router.get("/downtime-reasons", asyncHandler(async (_req, res) => {
  const items = await prisma.downtimeReason.findMany({ orderBy: { label: "asc" } });
  return ok(res, { items: items.map((item) => ({ id: item.id, code: item.code, label: item.label })) });
}));

router.post("/entries", requireRoles("ADMIN", "FACTORY_MANAGER", "LINE_SUPERVISOR"), asyncHandler(async (req, res) => {
  const parsed = productionEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid production entry payload", "INVALID_PRODUCTION_ENTRY", parsed.error.flatten());
  }
  const metricDate = new Date(parsed.data.metricDate);
  if (Number.isNaN(metricDate.getTime())) {
    return fail(res, 400, "Invalid production date", "INVALID_PRODUCTION_DATE");
  }
  if (parsed.data.rejectedQty > parsed.data.actualQty) {
    return fail(res, 409, "Rejected quantity cannot exceed actual quantity", "INVALID_REJECTED_QTY");
  }

  const entry = await prisma.productionEntry.create({
    data: {
      metricDate,
      lineId: parsed.data.lineId,
      orderId: parsed.data.orderId || null,
      shiftId: parsed.data.shiftId || null,
      stage: parsed.data.stage,
      plannedQty: parsed.data.plannedQty,
      actualQty: parsed.data.actualQty,
      rejectedQty: parsed.data.rejectedQty,
      downtimeMinutes: parsed.data.downtimeMinutes,
      downtimeReasonId: parsed.data.downtimeReasonId || null,
      remarks: parsed.data.remarks?.trim() || null,
    },
    include: {
      line: true,
      order: true,
      shift: true,
      downtimeReason: true,
    },
  });

  await writeAuditLog(req, {
    module: "Production",
    action: "Created production entry",
    targetType: "ProductionEntry",
    targetId: entry.id,
    targetLabel: `${entry.line.name} / ${entry.metricDate.toISOString().slice(0, 10)}`,
  });

  return ok(res, { item: mapEntry(entry) }, 201);
}));

router.patch("/entries/:id", requireRoles("ADMIN", "FACTORY_MANAGER", "LINE_SUPERVISOR"), asyncHandler(async (req, res) => {
  const parsed = productionEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid production entry payload", "INVALID_PRODUCTION_ENTRY", parsed.error.flatten());
  }
  const existing = await prisma.productionEntry.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return fail(res, 404, "Production entry not found", "PRODUCTION_ENTRY_NOT_FOUND");
  }
  const metricDate = new Date(parsed.data.metricDate);
  if (Number.isNaN(metricDate.getTime())) {
    return fail(res, 400, "Invalid production date", "INVALID_PRODUCTION_DATE");
  }
  if (parsed.data.rejectedQty > parsed.data.actualQty) {
    return fail(res, 409, "Rejected quantity cannot exceed actual quantity", "INVALID_REJECTED_QTY");
  }

  const workflowMeta = { module: "production", entityType: "ProductionEntry", entityId: existing.id, operation: "update" };
  await enforceWorkflowEditLimit(req, workflowMeta);

  const entry = await prisma.productionEntry.update({
    where: { id: req.params.id },
    data: {
      metricDate,
      lineId: parsed.data.lineId,
      orderId: parsed.data.orderId || null,
      shiftId: parsed.data.shiftId || null,
      stage: parsed.data.stage,
      plannedQty: parsed.data.plannedQty,
      actualQty: parsed.data.actualQty,
      rejectedQty: parsed.data.rejectedQty,
      downtimeMinutes: parsed.data.downtimeMinutes,
      downtimeReasonId: parsed.data.downtimeReasonId || null,
      remarks: parsed.data.remarks?.trim() || null,
    },
    include: {
      line: true,
      order: true,
      shift: true,
      downtimeReason: true,
    },
  });

  await writeAuditLog(req, {
    module: "Production",
    action: "Updated production entry",
    targetType: "ProductionEntry",
    targetId: entry.id,
    targetLabel: `${entry.line.name} / ${entry.metricDate.toISOString().slice(0, 10)}`,
  });
  await recordWorkflowEditLock(req, workflowMeta);

  return ok(res, { item: mapEntry(entry) });
}));

export default router;
