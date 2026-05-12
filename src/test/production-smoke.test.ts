import { describe, expect, it } from "vitest";
import { reconcileReleaseData } from "../../scripts/production-smoke.mjs";

describe("production smoke reconciliation", () => {
  it("accepts aligned dashboard, report, and mrp totals", () => {
    expect(() =>
      reconcileReleaseData({
        dashboard: {
          kpis: {
            totalOrders: 2,
            unitsPlanned: 300,
            unitsCompleted: 110,
            delayedOrders: 1,
          },
        },
        orders: {
          items: [
            { qty: 100, delivered: 40, status: "In Production" },
            { qty: 200, delivered: 70, status: "Delayed" },
          ],
        },
        orderStatusRows: [{}, {}],
        managementRows: [{ totalOrders: 2, unitsPlanned: 300, unitsDelivered: 110 }],
        mrpItems: [{ shortage: 25.5 }, { shortage: 4.5 }],
        mrpReportRows: [{ shortage: 25.5 }, { shortage: 4.5 }],
      }),
    ).not.toThrow();
  });

  it("fails when dashboard and reports diverge", () => {
    expect(() =>
      reconcileReleaseData({
        dashboard: {
          kpis: {
            totalOrders: 3,
            unitsPlanned: 300,
            unitsCompleted: 110,
            delayedOrders: 1,
          },
        },
        orders: {
          items: [
            { qty: 100, delivered: 40, status: "In Production" },
            { qty: 200, delivered: 70, status: "Delayed" },
          ],
        },
        orderStatusRows: [{}, {}],
        managementRows: [{ totalOrders: 2, unitsPlanned: 300, unitsDelivered: 110 }],
        mrpItems: [{ shortage: 30 }],
        mrpReportRows: [{ shortage: 30 }],
      }),
    ).toThrow("Dashboard totalOrders mismatch");
  });
});
