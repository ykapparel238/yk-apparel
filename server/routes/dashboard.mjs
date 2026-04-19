import { Router } from "express";
import { prisma } from "../db.mjs";

const router = Router();

function mapStatus(value) {
  if (value === "QA") return "QA";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

router.get("/", async (_req, res) => {
  const [
    orders,
    stageMetrics,
    lineMetrics,
    defects,
    alerts,
    vendors,
  ] = await Promise.all([
    prisma.purchaseOrder.findMany({
      include: { brand: true, style: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.stageDailyMetric.findMany({ orderBy: { metricDate: "asc" } }),
    prisma.lineDailyMetric.findMany({ orderBy: { metricDate: "asc" } }),
    prisma.qaInspectionDefect.findMany({ include: { defectType: true } }),
    prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.vendor.findMany({ include: { challans: true, weeklyMetrics: true } }),
  ]);

  const totalOrders = orders.length;
  const unitsPlanned = orders.reduce((sum, order) => sum + order.quantity, 0);
  const unitsCompleted = orders.reduce((sum, order) => sum + order.deliveredQty, 0);
  const unitsInProduction = orders
    .filter((order) => ["PLANNED", "IN_PRODUCTION", "QA", "DELAYED", "READY_TO_DISPATCH"].includes(order.status))
    .reduce((sum, order) => sum + Math.max(0, order.quantity - order.deliveredQty), 0);
  const delayedOrders = orders.filter((order) => order.status === "DELAYED").length;

  const latestSeven = stageMetrics.slice(-70);
  const byDay = new Map();
  latestSeven.forEach((metric) => {
    const key = metric.metricDate.toISOString().slice(0, 10);
    const current = byDay.get(key) ?? { planned: 0, actual: 0, rejected: 0 };
    current.planned += metric.plannedQty;
    current.actual += metric.actualQty;
    current.rejected += metric.rejectedQty;
    byDay.set(key, current);
  });
  const dailyTrend = Array.from(byDay.entries())
    .slice(-7)
    .map(([date, value]) => ({
      day: new Date(date).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      planned: value.planned,
      actual: value.actual,
      rejected: value.rejected,
    }));

  const qaTotal = defects.reduce((sum, defect) => sum + defect.count, 0);
  const groupedDefects = new Map();
  defects.forEach((defect) => {
    groupedDefects.set(defect.defectType.name, (groupedDefects.get(defect.defectType.name) ?? 0) + defect.count);
  });
  const qaDefects = Array.from(groupedDefects.entries())
    .map(([type, count]) => ({
      type,
      count,
      pct: qaTotal ? Math.round((count / qaTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const monthMap = new Map();
  lineMetrics.forEach((metric) => {
    const month = metric.metricDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const current = monthMap.get(month) ?? { capacity: 200000, used: 0 };
    current.used += metric.outputQty;
    monthMap.set(month, current);
  });
  const monthlyCapacity = Array.from(monthMap.entries()).map(([month, value]) => ({
    month,
    capacity: value.capacity,
    used: value.used,
  }));

  const brandMap = new Map();
  orders.forEach((order) => {
    brandMap.set(order.brand.name, (brandMap.get(order.brand.name) ?? 0) + order.quantity);
  });
  const brandSummary = Array.from(brandMap.entries()).map(([brand, units]) => ({ brand, units }));

  const latestStageDate = stageMetrics.length ? stageMetrics[stageMetrics.length - 1].metricDate.toISOString().slice(0, 10) : null;
  const productionStages = latestStageDate
    ? stageMetrics
        .filter((metric) => metric.metricDate.toISOString().slice(0, 10) === latestStageDate)
        .map((metric) => ({
          stage: mapStatus(metric.stage),
          planned: metric.plannedQty,
          actual: metric.actualQty,
          wip: metric.wipQty,
          rejected: metric.rejectedQty,
        }))
    : [];

  const lineEfficiency = lineMetrics.length
    ? Math.round(lineMetrics.reduce((sum, metric) => sum + metric.efficiencyPct, 0) / lineMetrics.length)
    : 0;
  const shipments = await prisma.dispatchShipment.findMany({
    include: { order: true },
  });
  const onTimeCount = shipments.filter((shipment) => shipment.dispatchDate <= shipment.order.dueDate).length;
  const otif = shipments.length ? Math.round((onTimeCount / shipments.length) * 100) : 0;
  const totalRejected = stageMetrics.reduce((sum, metric) => sum + metric.rejectedQty, 0);
  const totalChecked = stageMetrics.reduce((sum, metric) => sum + metric.actualQty, 0);
  const rejectionPct = totalChecked ? Number(((totalRejected / totalChecked) * 100).toFixed(1)) : 0;

  return res.json({
    kpis: {
      totalOrders,
      unitsPlanned,
      unitsInProduction,
      unitsCompleted,
      lineEfficiency,
      otif,
      rejectionPct,
      delayedOrders,
    },
    dailyTrend,
    qaDefects,
    monthlyCapacity,
    brandSummary,
    productionStages,
    alerts: alerts.map((alert) => ({
      id: alert.id,
      severity: alert.severity.toLowerCase(),
      title: alert.title,
      time: alert.createdAt.toISOString().slice(0, 16).replace("T", " "),
      module: alert.module,
    })),
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      process: vendor.process,
      pending: vendor.challans.reduce((sum, challan) => sum + Math.max(0, challan.outwardQty - challan.inwardQty), 0),
      otd: vendor.weeklyMetrics.length ? Math.round(vendor.weeklyMetrics.reduce((sum, metric) => sum + metric.onTimePct, 0) / vendor.weeklyMetrics.length) : 0,
      quality: vendor.weeklyMetrics.length ? Math.round(vendor.weeklyMetrics.reduce((sum, metric) => sum + metric.qualityPct, 0) / vendor.weeklyMetrics.length) : 0,
    })),
    orders: orders.slice(0, 7).map((order) => ({
      id: order.poNumber,
      brand: order.brand.name,
      qty: order.quantity,
      status: mapStatus(order.status),
    })),
  });
});

export default router;
