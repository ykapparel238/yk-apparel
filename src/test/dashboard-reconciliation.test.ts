import { describe, expect, it } from "vitest";
import { buildDashboardPayload } from "../../server/reporting.mjs";

describe("dashboard reconciliation", () => {
  it("derives exact KPI totals from deterministic seeded-style data", () => {
    const payload = buildDashboardPayload({
      orders: [
        { quantity: 24000, deliveredQty: 16800, status: "IN_PRODUCTION", brand: { name: "H&M" }, poNumber: "PO-1" },
        { quantity: 15000, deliveredQty: 9000, status: "IN_PRODUCTION", brand: { name: "Uniqlo" }, poNumber: "PO-2" },
        { quantity: 12500, deliveredQty: 4200, status: "DELAYED", brand: { name: "Zara" }, poNumber: "PO-3" },
        { quantity: 8500, deliveredQty: 8200, status: "QA", brand: { name: "M&S" }, poNumber: "PO-4" },
      ],
      stageMetrics: [
        { metricDate: new Date("2024-11-10T00:00:00.000Z"), stage: "KNITTING", plannedQty: 1000, actualQty: 900, wipQty: 50, rejectedQty: 20 },
        { metricDate: new Date("2024-11-11T00:00:00.000Z"), stage: "QUALITY_CHECK", plannedQty: 1200, actualQty: 1100, wipQty: 40, rejectedQty: 10 },
      ],
      lineMetrics: [
        { metricDate: new Date("2024-11-10T00:00:00.000Z"), efficiencyPct: 90, outputQty: 1500 },
        { metricDate: new Date("2024-11-11T00:00:00.000Z"), efficiencyPct: 88, outputQty: 1700 },
      ],
      defects: [
        { count: 30, defectType: { name: "Hole / Drop Stitch" } },
        { count: 10, defectType: { name: "Color Variation" } },
      ],
      alerts: [],
      vendors: [
        { id: "v1", name: "Vendor A", process: "Knitting", challans: [{ outwardQty: 100, inwardQty: 60 }], weeklyMetrics: [{ onTimePct: 90, qualityPct: 95 }] },
      ],
      shipments: [
        { dispatchDate: new Date("2024-11-15T00:00:00.000Z"), order: { dueDate: new Date("2024-11-16T00:00:00.000Z") } },
        { dispatchDate: new Date("2024-11-18T00:00:00.000Z"), order: { dueDate: new Date("2024-11-17T00:00:00.000Z") } },
      ],
    });

    expect(payload.kpis).toEqual({
      totalOrders: 4,
      unitsPlanned: 60000,
      unitsInProduction: 21800,
      unitsCompleted: 38200,
      lineEfficiency: 89,
      otif: 50,
      rejectionPct: 1.5,
      delayedOrders: 1,
    });
    expect(payload.vendors[0]).toMatchObject({ pending: 40, otd: 90, quality: 95 });
    expect(payload.qaDefects).toEqual([
      { type: "Hole / Drop Stitch", count: 30, pct: 75 },
      { type: "Color Variation", count: 10, pct: 25 },
    ]);
  });
});
