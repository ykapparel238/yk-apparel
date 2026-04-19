import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  lineDailyMetric: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  purchaseOrder: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  productionLine: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  productionPlan: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  stageDailyMetric: {
    findMany: vi.fn(),
  },
  qaInspection: {
    count: vi.fn(),
  },
  $transaction: vi.fn(),
};

const writeAuditLog = vi.fn();

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog }));

function createRes() {
  const res = {
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
    send(payload) {
      this.body = payload ?? null;
      return this;
    },
  };
  return res;
}

async function invokeRoute(router, method, path, reqOverrides = {}) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  const req = {
    body: {},
    query: {},
    params: {},
    sessionUser: { id: "u1", role: "ADMIN" },
    ...reqOverrides,
  };
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
  };
  return { req, res };
}

describe("planning route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.productionPlan.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects plans with quantity above the order quantity", async () => {
    const route = (await import("../../server/routes/planning.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-1",
      dueDate: new Date("2026-05-30T00:00:00.000Z"),
      quantity: 100,
      status: "CREATED",
      productionPlans: [],
    });
    prisma.productionLine.findUnique.mockResolvedValue({
      id: "line-1",
      capacityPerDay: 1000,
    });

    const { res } = await invokeRoute(route, "post", "/plans", {
      body: {
        orderId: "ord-1",
        lineId: "line-1",
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        plannedQty: 101,
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      code: "PLAN_QTY_EXCEEDS_ORDER",
    });
    expect(prisma.productionPlan.create).not.toHaveBeenCalled();
  });

  it("creates plans, updates order status, and writes audit logs", async () => {
    const route = (await import("../../server/routes/planning.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-1",
      poNumber: "PO-9",
      dueDate: new Date("2026-05-30T00:00:00.000Z"),
      quantity: 100,
      status: "CREATED",
      productionPlans: [],
    });
    prisma.productionLine.findUnique.mockResolvedValue({
      id: "line-1",
      name: "Line 1",
      capacityPerDay: 1000,
    });
    prisma.productionPlan.create.mockResolvedValue({
      id: "plan-1",
      orderId: "ord-1",
      lineId: "line-1",
      plannedQty: 90,
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-03T00:00:00.000Z"),
      status: "ACTIVE",
      order: { poNumber: "PO-9" },
      line: { name: "Line 1" },
    });

    const { res } = await invokeRoute(route, "post", "/plans", {
      body: {
        orderId: "ord-1",
        lineId: "line-1",
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        plannedQty: 90,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "ord-1" },
      data: { status: "PLANNED" },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        module: "planning",
        action: "CREATE",
        targetType: "ProductionPlan",
      }),
    );
  });
});
