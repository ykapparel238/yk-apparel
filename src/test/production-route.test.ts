import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  stageDailyMetric: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  lineDailyMetric: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  productionLine: {
    findMany: vi.fn(),
  },
};

vi.mock("../../server/db.mjs", () => ({ prisma }));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function invokeRoute(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role: "ADMIN" } };
  const res = createRes();
  const stack = layer.route.stack.map((entry) => entry.handle);
  for (const handler of stack) {
    await Promise.resolve(handler(req, res, () => {}));
  }
  return res;
}

describe("production route", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("returns latest stage metrics", async () => {
    const route = (await import("../../server/routes/production.mjs")).default;
    prisma.stageDailyMetric.aggregate.mockResolvedValue({ _max: { metricDate: new Date("2024-11-01T00:00:00.000Z") } });
    prisma.stageDailyMetric.findMany.mockResolvedValue([
      { stage: "QUALITY_CHECK", plannedQty: 100, actualQty: 95, wipQty: 2, rejectedQty: 1, pendingQty: 3 },
    ]);

    const res = await invokeRoute(route, "get", "/stages");

    expect(res.statusCode).toBe(200);
    expect(res.body.items[0]).toMatchObject({ stage: "Quality Check", planned: 100, actual: 95 });
  });

  it("returns line status payload", async () => {
    const route = (await import("../../server/routes/production.mjs")).default;
    prisma.lineDailyMetric.aggregate.mockResolvedValue({ _max: { metricDate: new Date("2024-11-01T00:00:00.000Z") } });
    prisma.productionLine.findMany.mockResolvedValue([{ id: "line-1", name: "Line 1", gauge: "7GG", machineCount: 20 }]);
    prisma.lineDailyMetric.findMany.mockResolvedValue([{ lineId: "line-1", outputQty: 1200, efficiencyPct: 91, isRunning: true }]);

    const res = await invokeRoute(route, "get", "/lines");

    expect(res.statusCode).toBe(200);
    expect(res.body.items[0]).toMatchObject({ name: "Line 1", output: 1200, status: "Running" });
  });
});
