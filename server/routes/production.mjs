import { Router } from "express";
import { prisma } from "../db.mjs";

const router = Router();

function mapStage(stage) {
  if (stage === "QA") return "QA";
  return stage
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

router.get("/stages", async (_req, res) => {
  const latestMetricDate = await prisma.stageDailyMetric.aggregate({ _max: { metricDate: true } });
  const metrics = latestMetricDate._max.metricDate
    ? await prisma.stageDailyMetric.findMany({
        where: { metricDate: latestMetricDate._max.metricDate },
        orderBy: { metricDate: "asc" },
      })
    : [];

  return res.json({
    items: metrics.map((metric) => ({
      stage: mapStage(metric.stage),
      planned: metric.plannedQty,
      actual: metric.actualQty,
      wip: metric.wipQty,
      rejected: metric.rejectedQty,
      pending: metric.pendingQty,
    })),
  });
});

router.get("/lines", async (_req, res) => {
  const latestMetricDate = await prisma.lineDailyMetric.aggregate({ _max: { metricDate: true } });
  const [lines, metrics] = await Promise.all([
    prisma.productionLine.findMany({ orderBy: { name: "asc" } }),
    latestMetricDate._max.metricDate
      ? prisma.lineDailyMetric.findMany({ where: { metricDate: latestMetricDate._max.metricDate } })
      : Promise.resolve([]),
  ]);

  const metricMap = new Map(metrics.map((metric) => [metric.lineId, metric]));

  return res.json({
    items: lines.map((line) => {
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
});

export default router;
