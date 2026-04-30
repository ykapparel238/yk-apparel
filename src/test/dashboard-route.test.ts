import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardPayload = vi.fn();

vi.mock("../../server/reporting.mjs", () => ({
  getDashboardPayload,
}));

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

async function invokeRoute(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role: "ADMIN" } };
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

describe("dashboard route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns shared reporting payload", async () => {
    const route = (await import("../../server/routes/dashboard.mjs")).default;
    getDashboardPayload.mockResolvedValue({
      kpis: { totalOrders: 4, unitsPlanned: 100, unitsInProduction: 40, unitsCompleted: 60, lineEfficiency: 89, otif: 92, rejectionPct: 1.8, delayedOrders: 1 },
      dailyTrend: [],
      qaDefects: [],
      monthlyCapacity: [],
      brandSummary: [],
      productionStages: [],
      alerts: [],
      vendors: [],
      orders: [],
    });

    const res = await invokeRoute(route, "get", "/");

    expect(res.statusCode).toBe(200);
    expect(getDashboardPayload).toHaveBeenCalled();
    expect(res.body.kpis.totalOrders).toBe(4);
  });
});
