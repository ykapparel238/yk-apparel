import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  alert: { findMany: vi.fn() },
  purchaseOrder: { findMany: vi.fn() },
  productionPlan: { findMany: vi.fn() },
  productionEntry: { findMany: vi.fn() },
  productionLine: { findMany: vi.fn() },
  shift: { findMany: vi.fn() },
  downtimeReason: { findMany: vi.fn() },
  qaInspection: { findMany: vi.fn() },
  qaDefectType: { findMany: vi.fn() },
  correctiveAction: { findMany: vi.fn() },
  vendor: { findMany: vi.fn() },
  material: { findMany: vi.fn() },
  procurementRequest: { findMany: vi.fn() },
  supplierPurchaseOrder: { findMany: vi.fn() },
  vendorChallan: { findMany: vi.fn() },
  workflowChangeRequest: { findMany: vi.fn() },
  syncConflict: { findMany: vi.fn() },
  desktopDevice: { findMany: vi.fn() },
};

vi.mock("../../server/db.mjs", () => ({ prisma }));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function invokeRoute(router, role = "ADMIN", actualRole = role) {
  const layer = router.stack.find((entry) => entry.route?.path === "/today" && entry.route.methods.get);
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role, actualRole } };
  const res = createRes();
  const stack = layer.route.stack.map((entry) => entry.handle);
  for (const handler of stack) {
    let nextCalled = false;
    let nextError = null;
    await Promise.resolve(handler(req, res, (error) => {
      nextCalled = true;
      nextError = error ?? null;
    }));
    if (nextError) throw nextError;
    if (!nextCalled && handler.length >= 3) break;
  }
  return { req, res };
}

describe("ops today route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.alert.findMany.mockResolvedValue([]);
    prisma.purchaseOrder.findMany.mockResolvedValue([]);
    prisma.productionPlan.findMany.mockResolvedValue([]);
    prisma.productionEntry.findMany.mockResolvedValue([]);
    prisma.productionLine.findMany.mockResolvedValue([{ id: "line-1", name: "Line 1" }]);
    prisma.shift.findMany.mockResolvedValue([]);
    prisma.downtimeReason.findMany.mockResolvedValue([]);
    prisma.qaInspection.findMany.mockResolvedValue([]);
    prisma.qaDefectType.findMany.mockResolvedValue([]);
    prisma.correctiveAction.findMany.mockResolvedValue([]);
    prisma.vendor.findMany.mockResolvedValue([]);
    prisma.material.findMany.mockResolvedValue([]);
    prisma.procurementRequest.findMany.mockResolvedValue([]);
    prisma.supplierPurchaseOrder.findMany.mockResolvedValue([]);
    prisma.vendorChallan.findMany.mockResolvedValue([]);
    prisma.workflowChangeRequest.findMany.mockResolvedValue([]);
    prisma.syncConflict.findMany.mockResolvedValue([]);
    prisma.desktopDevice.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns only production work for line supervisors", async () => {
    const route = (await import("../../server/routes/ops.mjs")).default;
    prisma.productionPlan.findMany.mockResolvedValue([
      {
        id: "plan-1",
        orderId: "order-1",
        lineId: "line-1",
        plannedQty: 500,
        dailyTarget: 125,
        order: { poNumber: "PO-1001", dueDate: new Date("2026-07-10T00:00:00.000Z") },
        line: { name: "Line 1" },
      },
    ]);

    const { res } = await invokeRoute(route, "LINE_SUPERVISOR");

    expect(res.statusCode).toBe(200);
    expect(res.body.workItems.map((item) => item.module)).toEqual(["production"]);
    expect(res.body.workItems[0]).toMatchObject({
      entityType: "ProductionPlan",
      action: { type: "productionEntry", route: "/production" },
    });
  });

  it("gives store managers inventory actions without dispatch writes", async () => {
    const route = (await import("../../server/routes/ops.mjs")).default;
    prisma.material.findMany.mockResolvedValue([
      { id: "mat-1", sku: "Y001", name: "Cotton Yarn", uom: "KG", stockQty: "10", reorderLevel: "25", supplier: { name: "Supplier A" } },
    ]);

    const { res } = await invokeRoute(route, "STORE_MANAGER");

    expect(res.statusCode).toBe(200);
    expect(res.body.actions.map((item) => item.type)).toEqual(expect.arrayContaining(["inventoryAdjustment", "procurementRequestUpdate", "supplierPoUpdate", "goodsReceipt"]));
    expect(res.body.workItems.every((item) => item.module === "inventory")).toBe(true);
    expect(res.body.actions.map((item) => item.type)).not.toContain("vendorChallan");
  });

  it("sorts admin critical sync and delayed work ahead of normal work", async () => {
    const route = (await import("../../server/routes/ops.mjs")).default;
    prisma.purchaseOrder.findMany
      .mockResolvedValueOnce([{ id: "order-1", poNumber: "PO-1001" }])
      .mockResolvedValueOnce([
        {
          id: "order-delay",
          poNumber: "PO-9001",
          dueDate: new Date("2026-06-01T00:00:00.000Z"),
          brand: { name: "YK" },
          style: { name: "Crew Neck" },
        },
      ])
      .mockResolvedValue([]);
    prisma.syncConflict.findMany.mockResolvedValue([
      {
        id: "sync-1",
        summary: "Order changed before local sync",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);

    const { res } = await invokeRoute(route, "ADMIN");

    expect(res.statusCode).toBe(200);
    expect(res.body.workItems[0]).toMatchObject({ module: "sync", severity: "critical" });
    expect(res.body.workItems.some((item) => item.module === "orders" && item.severity === "critical")).toBe(true);
    expect(res.body.summary.critical).toBeGreaterThanOrEqual(2);
  });
});
