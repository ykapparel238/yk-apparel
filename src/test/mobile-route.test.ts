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
  vendor: { findMany: vi.fn() },
  material: { findMany: vi.fn() },
  procurementRequest: { findMany: vi.fn() },
  supplierPurchaseOrder: { findMany: vi.fn() },
  vendorChallan: { findMany: vi.fn() },
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

async function invokeRoute(router, role = "ADMIN") {
  const layer = router.stack.find((entry) => entry.route?.path === "/today" && entry.route.methods.get);
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role, actualRole: role } };
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

describe("mobile today route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.alert.findMany.mockResolvedValue([]);
    prisma.purchaseOrder.findMany.mockResolvedValue([]);
    prisma.productionEntry.findMany.mockResolvedValue([]);
    prisma.productionPlan.findMany.mockResolvedValue([]);
    prisma.productionLine.findMany.mockResolvedValue([{ id: "line-1", name: "Line 1" }]);
    prisma.shift.findMany.mockResolvedValue([{ id: "shift-1", name: "Morning" }]);
    prisma.downtimeReason.findMany.mockResolvedValue([]);
    prisma.qaInspection.findMany.mockResolvedValue([]);
    prisma.qaDefectType.findMany.mockResolvedValue([{ id: "defect-1", name: "Needle mark" }]);
    prisma.vendor.findMany.mockResolvedValue([{ id: "vendor-1", name: "Vendor A" }]);
    prisma.material.findMany.mockResolvedValue([]);
    prisma.procurementRequest.findMany.mockResolvedValue([]);
    prisma.supplierPurchaseOrder.findMany.mockResolvedValue([]);
    prisma.vendorChallan.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns only production quick actions for line supervisors", async () => {
    const route = (await import("../../server/routes/mobile.mjs")).default;
    prisma.productionEntry.findMany.mockResolvedValue([
      {
        id: "entry-1",
        stage: "KNITTING",
        actualQty: 120,
        rejectedQty: 2,
        line: { name: "Line 1" },
        order: { poNumber: "PO-1001" },
      },
    ]);
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
    expect(res.body.actions.map((item) => item.type)).toEqual(["productionEntry"]);
    expect(res.body.options.lines).toEqual([{ id: "line-1", name: "Line 1" }]);
    expect(res.body.recent[0]).toMatchObject({ type: "production", route: "/production" });
    expect(res.body.workItems[0]).toMatchObject({
      title: "Record actuals for PO-1001",
      action: {
        type: "productionEntry",
        defaults: { orderId: "order-1", lineId: "line-1", plannedQty: "125" },
      },
    });
  });

  it("returns inventory actions without vendor or dispatch writes for store managers", async () => {
    const route = (await import("../../server/routes/mobile.mjs")).default;
    prisma.material.findMany.mockResolvedValue([
      { id: "mat-1", sku: "Y001", name: "Cotton Yarn", uom: "KG", stockQty: "10", reorderLevel: "25", supplier: { name: "Supplier A" } },
    ]);

    const { res } = await invokeRoute(route, "STORE_MANAGER");

    expect(res.statusCode).toBe(200);
    expect(res.body.actions.map((item) => item.type)).toEqual(expect.arrayContaining(["inventoryAdjustment", "procurementRequestUpdate", "supplierPoUpdate", "goodsReceipt"]));
    expect(res.body.cards[0]).toMatchObject({ id: "stores", count: 1, tone: "warning" });
    expect(res.body.options.materials[0]).toMatchObject({ sku: "Y001", supplier: "Supplier A" });
    expect(res.body.workItems[0]).toMatchObject({
      title: "Check stock Y001",
      action: { type: "inventoryAdjustment", defaults: { sku: "Y001" } },
    });
    expect(prisma.vendorChallan.findMany).not.toHaveBeenCalled();
  });

  it("returns dispatch queue actions for dispatch managers", async () => {
    const route = (await import("../../server/routes/mobile.mjs")).default;
    prisma.purchaseOrder.findMany
      .mockResolvedValueOnce([{ id: "order-1", poNumber: "PO-1001" }])
      .mockResolvedValueOnce([
        {
          id: "order-1",
          poNumber: "PO-1001",
          quantity: 500,
          deliveredQty: 200,
          dueDate: new Date("2026-07-10T00:00:00.000Z"),
          brand: { name: "YK" },
          style: { name: "Crew Neck" },
          shipments: [],
        },
      ]);

    const { res } = await invokeRoute(route, "DISPATCH_MANAGER");

    expect(res.statusCode).toBe(200);
    expect(res.body.actions.map((item) => item.type)).toEqual(expect.arrayContaining(["dispatchShipment", "dispatchShipmentUpdate"]));
    expect(res.body.options.dispatchOrders[0]).toMatchObject({ poNumber: "PO-1001", remaining: 300 });
    expect(res.body.workItems[0]).toMatchObject({
      title: "Dispatch PO-1001",
      action: { type: "dispatchShipment", defaults: { orderId: "order-1", quantity: "300" } },
    });
  });
});
