import { describe, expect, it } from "vitest";
import { reconcileOperationalReports, reconcileReleaseData } from "../../scripts/production-smoke.mjs";

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

  it("accepts aligned procurement, production, CAPA, and tech pack reports", () => {
    expect(() =>
      reconcileOperationalReports({
        purchaseOrders: {
          items: [
            { orderedQty: 1200, receivedQty: 800 },
            { orderedQty: 300, receivedQty: 300 },
          ],
        },
        procurementRows: [
          { orderedQty: 1200, receivedQty: 800 },
          { orderedQty: 300, receivedQty: 300 },
        ],
        productionEntries: {
          items: [
            { actualQty: 100, rejectedQty: 4 },
            { actualQty: 90, rejectedQty: 3 },
          ],
        },
        productionRows: [
          { actualQty: 100, rejectedQty: 4 },
          { actualQty: 90, rejectedQty: 3 },
        ],
        capaItems: {
          items: [
            { status: "OPEN" },
            { status: "CLOSED" },
          ],
        },
        capaRows: [
          { status: "Open" },
          { status: "Closed" },
        ],
        styleTechPack: {
          styleCode: "ST-1",
          assets: [{}],
          samples: [{}, {}],
          measurements: [{}],
          threadSpecs: [{}, {}],
        },
        techPackRows: [
          {
            styleCode: "ST-1",
            assetCount: 1,
            sampleCount: 2,
            measurementCount: 1,
            threadSpecCount: 2,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("fails when operational reports diverge", () => {
    expect(() =>
      reconcileOperationalReports({
        purchaseOrders: {
          items: [{ orderedQty: 1200, receivedQty: 800 }],
        },
        procurementRows: [{ orderedQty: 1200, receivedQty: 700 }],
        productionEntries: { items: [{ actualQty: 100, rejectedQty: 4 }] },
        productionRows: [{ actualQty: 95, rejectedQty: 4 }],
        capaItems: { items: [{ status: "OPEN" }] },
        capaRows: [{ status: "Closed" }],
        styleTechPack: {
          styleCode: "ST-1",
          assets: [{}],
          samples: [],
          measurements: [],
          threadSpecs: [],
        },
        techPackRows: [{ styleCode: "ST-1", assetCount: 2, sampleCount: 0, measurementCount: 0, threadSpecCount: 0 }],
      }),
    ).toThrow("Procurement received total mismatch");
  });
});
