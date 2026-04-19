import { Router } from "express";
import { prisma } from "../db.mjs";

const router = Router();

router.get("/", async (_req, res) => {
  const [
    stageMetrics,
    orders,
    lineMetrics,
    vendors,
    materials,
    defects,
    shipments,
  ] = await Promise.all([
    prisma.stageDailyMetric.count(),
    prisma.purchaseOrder.count(),
    prisma.lineDailyMetric.count(),
    prisma.vendorWeeklyMetric.count(),
    prisma.material.count(),
    prisma.qaInspection.count(),
    prisma.dispatchShipment.count(),
  ]);

  return res.json({
    items: [
      { name: "Daily Production Report", desc: "Stage-wise output, efficiency, rejection by line", category: "Production", rows: stageMetrics },
      { name: "Order Status Report", desc: "PO lifecycle, delays, dispatch readiness", category: "Merchandising", rows: orders },
      { name: "Line Performance", desc: "Efficiency, output, downtime per knitting line", category: "Production", rows: lineMetrics },
      { name: "Vendor Performance Scorecard", desc: "OTD, quality, capacity utilization", category: "Vendor", rows: vendors },
      { name: "Stock Report", desc: "Yarn, trims, packing — current and aged inventory", category: "Stores", rows: materials },
      { name: "Rejection & Rework Report", desc: "Defect analysis, root cause, vendor breakdown", category: "QA", rows: defects },
      { name: "Dispatch Report", desc: "Shipment status, OTIF, brand-wise delivery", category: "Logistics", rows: shipments },
      { name: "Management Summary", desc: "Executive KPIs across all departments", category: "Executive", rows: 1 },
    ],
  });
});

export default router;
