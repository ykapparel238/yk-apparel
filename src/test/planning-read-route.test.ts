import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  lineDailyMetric: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  purchaseOrder: {
    findMany: vi.fn(),
  },
  productionLine: {
    findMany: vi.fn(),
  },
  productionPlan: {
    findMany: vi.fn(),
  },
  stageDailyMetric: {
    findMany: vi.fn(),
  },
};

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog: vi.fn() }));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function invokeRoute(router, method, path, reqOverrides = {}) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role: "ADMIN" }, ...reqOverrides };
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
  return res;
}

describe("planning read routes", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("returns calendar payload from real metrics and plans", async () => {
    const route = (await import("../../server/routes/planning.mjs")).default;
    prisma.stageDailyMetric.findMany.mockResolvedValue([
      { metricDate: new Date("2024-11-01T00:00:00.000Z"), plannedQty: 100, actualQty: 90 },
    ]);
    prisma.productionLine.findMany.mockResolvedValue([{ id: "line-1", name: "Line 1", gauge: "7GG" }]);
    prisma.productionPlan.findMany.mockResolvedValue([
      { lineId: "line-1", plannedQty: 500, order: { poNumber: "PO-1" } },
    ]);
    prisma.purchaseOrder.findMany.mockResolvedValue([{ poNumber: "PO-1" }]);

    const res = await invokeRoute(route, "get", "/calendar", { query: { month: "2024-11" } });

    expect(res.statusCode).toBe(200);
    expect(res.body.monthLabel).toBe("November 2024");
    expect(res.body.days[0]).toMatchObject({ day: 1, target: 100, actual: 90, status: "warn" });
    expect(res.body.lines[0].allocations[0].poNumber).toBe("PO-1");
  });
});
