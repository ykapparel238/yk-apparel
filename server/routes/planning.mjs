import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../audit.mjs";
import { prisma } from "../db.mjs";
import { asyncHandler, fail, ok } from "../http.mjs";
import { enforceWorkflowEditLimit, recordWorkflowEditLock } from "../workflow-control.mjs";

const router = Router();

const planSchema = z.object({
  orderId: z.string().min(1),
  lineId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  plannedQty: z.coerce.number().int().positive(),
});

function mapStatus(status) {
  if (status === "QA") return "QA";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapAllocation(plan) {
  return {
    id: plan.id,
    orderId: plan.orderId,
    lineId: plan.lineId,
    poNumber: plan.order.poNumber,
    lineName: plan.line.name,
    plannedQty: plan.plannedQty,
    startDate: plan.startDate.toISOString().slice(0, 10),
    endDate: plan.endDate.toISOString().slice(0, 10),
    status: mapStatus(plan.status),
  };
}

export function toUtcDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateDayCount(startDate, endDate) {
  return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export function calculateDailyTarget(plannedQty, startDate, endDate) {
  return Math.round(plannedQty / calculateDayCount(startDate, endDate));
}

async function validatePlanInput(data, currentPlanId) {
  const startDate = toUtcDate(data.startDate);
  const endDate = toUtcDate(data.endDate);
  if (!startDate || !endDate) {
    return { error: { status: 400, message: "Invalid plan dates", code: "INVALID_PLAN_DATES" } };
  }
  if (endDate < startDate) {
    return { error: { status: 400, message: "Plan end date must be on or after start date", code: "INVALID_PLAN_WINDOW" } };
  }

  const [order, line, overlappingPlans] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id: data.orderId },
      include: { productionPlans: true },
    }),
    prisma.productionLine.findUnique({
      where: { id: data.lineId },
    }),
    prisma.productionPlan.findMany({
      where: {
        lineId: data.lineId,
        id: currentPlanId ? { not: currentPlanId } : undefined,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    }),
  ]);

  if (!order) {
    return { error: { status: 400, message: "Selected order no longer exists", code: "ORDER_NOT_FOUND" } };
  }
  if (!line) {
    return { error: { status: 400, message: "Selected line no longer exists", code: "LINE_NOT_FOUND" } };
  }
  if (data.plannedQty > order.quantity) {
    return { error: { status: 409, message: "Planned quantity cannot exceed the order quantity", code: "PLAN_QTY_EXCEEDS_ORDER" } };
  }
  if (endDate > order.dueDate) {
    return { error: { status: 409, message: "Plan window cannot exceed the order due date", code: "PLAN_AFTER_DUE_DATE" } };
  }
  if (order.status === "DISPATCHED") {
    return { error: { status: 409, message: "Dispatched orders cannot be replanned", code: "ORDER_ALREADY_DISPATCHED" } };
  }

  const overlappingQty = overlappingPlans.reduce((sum, plan) => sum + plan.plannedQty, 0);
  const dayCount = calculateDayCount(startDate, endDate);
  const windowCapacity = line.capacityPerDay * dayCount;
  if (overlappingQty + data.plannedQty > windowCapacity) {
    return {
      error: {
        status: 409,
        message: `Line capacity exceeded for the selected window (${windowCapacity.toLocaleString("en-IN")} units available)`,
        code: "LINE_CAPACITY_EXCEEDED",
      },
    };
  }

  const existingPlans = order.productionPlans.filter((plan) => plan.id !== currentPlanId);
  if (existingPlans.length > 0 && !currentPlanId) {
    return { error: { status: 409, message: "This order already has a planning allocation", code: "ORDER_ALREADY_PLANNED" } };
  }

  return { startDate, endDate, order, line };
}

router.get("/board", asyncHandler(async (_req, res) => {
  const [latestMetricDate, orders, lines, plans] = await Promise.all([
    prisma.lineDailyMetric.aggregate({ _max: { metricDate: true } }),
    prisma.purchaseOrder.findMany({
      include: { brand: true, style: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.productionLine.findMany({ orderBy: { name: "asc" } }),
    prisma.productionPlan.findMany({
      include: { order: true, line: true },
    }),
  ]);

  const lineMetrics = latestMetricDate._max.metricDate
    ? await prisma.lineDailyMetric.findMany({
        where: { metricDate: latestMetricDate._max.metricDate },
        orderBy: { line: { name: "asc" } },
      })
    : [];

  const metricMap = new Map(lineMetrics.map((metric) => [metric.lineId, metric]));

  return ok(res, {
    lines: lines.map((line) => {
      const metric = metricMap.get(line.id);
      return {
        id: line.id,
        name: line.name,
        gauge: line.gauge,
        machines: line.machineCount,
        efficiency: metric?.efficiencyPct ?? 0,
        output: metric?.outputQty ?? 0,
      };
    }),
    orders: orders.map((order) => ({
      id: order.id,
      poNumber: order.poNumber,
      brand: order.brand.name,
      styleName: order.style.name,
      season: order.seasonCode,
      qty: order.quantity,
      due: order.dueDate.toISOString().slice(0, 10),
      status: mapStatus(order.status),
      priority: mapStatus(order.priority),
      progress: order.status === "DISPATCHED" ? 100 : Math.round((order.deliveredQty / Math.max(1, order.quantity)) * 100),
    })),
    allocations: plans.map((plan) => ({
      ...mapAllocation(plan),
    })),
  });
}));

router.post("/plans", asyncHandler(async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid plan payload", "INVALID_PLAN_PAYLOAD", parsed.error.flatten());
  }

  const validated = await validatePlanInput(parsed.data);
  if ("error" in validated) {
    return fail(res, validated.error.status, validated.error.message, validated.error.code);
  }

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.productionPlan.create({
      data: {
        orderId: parsed.data.orderId,
        lineId: parsed.data.lineId,
        startDate: validated.startDate,
        endDate: validated.endDate,
        plannedQty: parsed.data.plannedQty,
        dailyTarget: calculateDailyTarget(parsed.data.plannedQty, validated.startDate, validated.endDate),
        status: "ACTIVE",
      },
      include: {
        order: true,
        line: true,
      },
    });

    if (validated.order.status === "CREATED") {
      await tx.purchaseOrder.update({
        where: { id: parsed.data.orderId },
        data: { status: "PLANNED" },
      });
    }

    await writeAuditLog(req, {
      tx,
      module: "planning",
      action: "CREATE",
      targetType: "ProductionPlan",
      targetId: plan.id,
      targetLabel: `${plan.order.poNumber} -> ${plan.line.name}`,
    });

    return plan;
  });

  return res.status(201).json({ item: mapAllocation(created) });
}));

router.patch("/plans/:id", asyncHandler(async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid plan payload", "INVALID_PLAN_PAYLOAD", parsed.error.flatten());
  }

  const existing = await prisma.productionPlan.findUnique({
    where: { id: req.params.id },
    include: {
      order: true,
      line: true,
    },
  });
  if (!existing) {
    return fail(res, 404, "Plan not found", "PLAN_NOT_FOUND");
  }

  const validated = await validatePlanInput(parsed.data, req.params.id);
  if ("error" in validated) {
    return fail(res, validated.error.status, validated.error.message, validated.error.code);
  }

  const workflowMeta = { module: "planning", entityType: "ProductionPlan", entityId: existing.id, operation: "update" };
  await enforceWorkflowEditLimit(req, workflowMeta);

  const updated = await prisma.$transaction(async (tx) => {
    const plan = await tx.productionPlan.update({
      where: { id: req.params.id },
      data: {
        orderId: parsed.data.orderId,
        lineId: parsed.data.lineId,
        startDate: validated.startDate,
        endDate: validated.endDate,
        plannedQty: parsed.data.plannedQty,
        dailyTarget: calculateDailyTarget(parsed.data.plannedQty, validated.startDate, validated.endDate),
      },
      include: {
        order: true,
        line: true,
      },
    });

    if (validated.order.status === "CREATED") {
      await tx.purchaseOrder.update({
        where: { id: parsed.data.orderId },
        data: { status: "PLANNED" },
      });
    }

    await writeAuditLog(req, {
      tx,
      module: "planning",
      action: "UPDATE",
      targetType: "ProductionPlan",
      targetId: plan.id,
      targetLabel: `${plan.order.poNumber} -> ${plan.line.name}`,
    });
    await recordWorkflowEditLock(req, workflowMeta, tx);

    return plan;
  });

  return ok(res, { item: mapAllocation(updated) });
}));

router.get("/calendar", asyncHandler(async (req, res) => {
  const month = String(req.query.month || "2024-11");
  const [year, monthPart] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthPart - 1, 1));
  const end = new Date(Date.UTC(year, monthPart, 0, 23, 59, 59));

  const [stageMetrics, lines, plans, orders] = await Promise.all([
    prisma.stageDailyMetric.findMany({
      where: {
        metricDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { metricDate: "asc" },
    }),
    prisma.productionLine.findMany({ orderBy: { name: "asc" } }),
    prisma.productionPlan.findMany({
      include: { order: true },
      where: {
        startDate: { lte: end },
        endDate: { gte: start },
      },
    }),
    prisma.purchaseOrder.findMany({ orderBy: { poNumber: "asc" } }),
  ]);

  const grouped = new Map();
  for (const metric of stageMetrics) {
    const key = metric.metricDate.toISOString().slice(0, 10);
    const current = grouped.get(key) ?? { target: 0, actual: 0 };
    current.target += metric.plannedQty;
    current.actual += metric.actualQty;
    grouped.set(key, current);
  }

  const calendarDays = Array.from({ length: end.getUTCDate() }, (_, index) => {
    const day = index + 1;
    const key = new Date(Date.UTC(year, monthPart - 1, day)).toISOString().slice(0, 10);
    const totals = grouped.get(key) ?? { target: 0, actual: 0 };
    const ratio = totals.target > 0 ? totals.actual / totals.target : 0;
    const status = ratio >= 1 ? "ok" : ratio >= 0.85 ? "warn" : "miss";
    return {
      day,
      target: totals.target,
      actual: totals.actual,
      status,
    };
  });

  const lineAllocations = lines.map((line, index) => {
    const linePlans = plans.filter((plan) => plan.lineId === line.id).slice(0, 2);
    const fill = Math.min(
      100,
      Math.max(
        0,
        linePlans.reduce((sum, plan) => sum + Math.round(plan.plannedQty / 250), 0) || (60 + ((index * 11) % 38)),
      ),
    );

    return {
      id: line.id,
      name: line.name,
      gauge: line.gauge,
      fill,
      allocations: linePlans.length
        ? linePlans.map((plan, allocIndex) => ({
            poNumber: plan.order.poNumber,
            width: allocIndex === 0 ? Math.round(fill * 0.55) : Math.round(fill * 0.3),
          }))
        : orders.slice(index, index + 2).map((order, allocIndex) => ({
            poNumber: order.poNumber,
            width: allocIndex === 0 ? Math.round(fill * 0.55) : Math.round(fill * 0.3),
          })),
    };
  });

  return ok(res, {
    monthLabel: start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    days: calendarDays,
    lines: lineAllocations,
  });
}));

export default router;
