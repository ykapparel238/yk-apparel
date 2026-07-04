import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  purchaseOrder: { findMany: vi.fn() },
  productionEntry: { findMany: vi.fn() },
  material: { findMany: vi.fn() },
  correctiveAction: { findMany: vi.fn() },
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
  const layer = router.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.get);
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
  return { res };
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

describe("exceptions route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.purchaseOrder.findMany.mockResolvedValue([]);
    prisma.productionEntry.findMany.mockResolvedValue([]);
    prisma.material.findMany.mockResolvedValue([]);
    prisma.correctiveAction.findMany.mockResolvedValue([]);
    prisma.vendorChallan.findMany.mockResolvedValue([]);
  });

  it("returns role-filtered exception command items", async () => {
    const route = (await import("../../server/routes/exceptions.mjs")).default;
    prisma.purchaseOrder.findMany.mockResolvedValue([
      {
        id: "order-1",
        poNumber: "PO-1001",
        quantity: 500,
        deliveredQty: 0,
        dueDate: daysFromNow(4),
        status: "CREATED",
        brand: { name: "Brand A" },
        style: { name: "Crew Neck" },
        productionPlans: [],
        productionEntries: [],
        qaInspections: [],
        shipments: [],
        correctiveActions: [],
        createdAt: daysFromNow(-1),
        updatedAt: daysFromNow(-1),
      },
    ]);
    prisma.material.findMany.mockResolvedValue([
      {
        id: "mat-1",
        sku: "Y001",
        name: "Cotton Yarn",
        stockQty: 5,
        reorderLevel: 25,
        supplier: { name: "Supplier A" },
        updatedAt: daysFromNow(-2),
      },
    ]);

    const { res } = await invokeRoute(route, "PRODUCTION_PLANNER");

    expect(res.statusCode).toBe(200);
    expect(res.body.kpis.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      id: "order-unplanned-order-1",
      severity: "critical",
      module: "Planning",
      ownerRole: "PRODUCTION_PLANNER",
      actionLabel: "Create plan",
    });
  });

  it("includes inventory and CAPA exceptions for admins", async () => {
    const route = (await import("../../server/routes/exceptions.mjs")).default;
    prisma.material.findMany.mockResolvedValue([
      {
        id: "mat-1",
        sku: "Y001",
        name: "Cotton Yarn",
        stockQty: 0,
        reorderLevel: 25,
        supplier: { name: "Supplier A" },
        updatedAt: daysFromNow(-2),
      },
    ]);
    prisma.correctiveAction.findMany.mockResolvedValue([
      {
        id: "capa-1",
        title: "Needle marks",
        ownerName: "QA Lead",
        dueDate: daysFromNow(-1),
        order: { poNumber: "PO-1002" },
        vendor: null,
        line: null,
      },
    ]);

    const { res } = await invokeRoute(route, "ADMIN");

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "material-low-mat-1", module: "Inventory", severity: "critical" }),
      expect.objectContaining({ id: "capa-overdue-capa-1", module: "QA", severity: "critical" }),
    ]));
    expect(res.body.kpis.critical).toBe(2);
  });
});
