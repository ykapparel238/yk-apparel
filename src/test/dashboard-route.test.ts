import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardPayload = vi.fn();
const dashboardRows = vi.fn();
const toCsv = vi.fn();
const toPdfBuffer = vi.fn();

vi.mock("../../server/reporting.mjs", () => ({
  dashboardRows,
  getDashboardPayload,
  toCsv,
  toPdfBuffer,
}));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
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

    const res = await invokeRoute(route, "get", "/", {
      query: { status: "PLANNED" },
    });

    expect(res.statusCode).toBe(200);
    expect(getDashboardPayload).toHaveBeenCalledWith({ status: "PLANNED" });
    expect(res.body.kpis.totalOrders).toBe(4);
  });

  it("exports dashboard CSV with filters", async () => {
    const route = (await import("../../server/routes/dashboard.mjs")).default;
    const payload = { kpis: { totalOrders: 4 } };
    getDashboardPayload.mockResolvedValue(payload);
    dashboardRows.mockReturnValue([{ metric: "Total Orders", value: 4 }]);
    toCsv.mockReturnValue("metric,value\nTotal Orders,4");

    const res = await invokeRoute(route, "get", ".csv", {
      query: { dateFrom: "2026-05-01", dateTo: "2026-05-31" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/csv");
    expect(getDashboardPayload).toHaveBeenCalledWith({ dateFrom: "2026-05-01", dateTo: "2026-05-31" });
    expect(res.body).toContain("Total Orders");
  });

  it("rejects invalid dashboard status filters", async () => {
    const route = (await import("../../server/routes/dashboard.mjs")).default;

    const res = await invokeRoute(route, "get", "/", {
      query: { status: "BAD_STATUS" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_DASHBOARD_FILTERS");
  });
});
