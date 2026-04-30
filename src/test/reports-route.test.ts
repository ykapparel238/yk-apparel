import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getReportSummaries = vi.fn();
const getReportRows = vi.fn();
const toCsv = vi.fn();

vi.mock("../../server/reporting.mjs", () => ({
  getReportSummaries,
  getReportRows,
  toCsv,
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
  return { req, res };
}

describe("reports route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns report summaries", async () => {
    const route = (await import("../../server/routes/reports.mjs")).default;
    getReportSummaries.mockResolvedValue({
      items: [{ slug: "stock-report", name: "Stock Report", desc: "desc", category: "Stores", rows: 4, downloadUrl: "/api/reports/stock-report.csv" }],
    });

    const { res } = await invokeRoute(route, "get", "/");

    expect(res.statusCode).toBe(200);
    expect(res.body.items[0].slug).toBe("stock-report");
  });

  it("returns report rows by slug", async () => {
    const route = (await import("../../server/routes/reports.mjs")).default;
    getReportRows.mockResolvedValue({
      report: { slug: "stock-report", name: "Stock Report", category: "Stores" },
      rows: [{ sku: "Y001", freeQty: 50 }],
    });

    const { res } = await invokeRoute(route, "get", "/:slug", {
      params: { slug: "stock-report" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  it("returns CSV output by slug", async () => {
    const route = (await import("../../server/routes/reports.mjs")).default;
    getReportRows.mockResolvedValue({
      report: { slug: "stock-report", name: "Stock Report", category: "Stores" },
      rows: [{ sku: "Y001", freeQty: 50 }],
    });
    toCsv.mockReturnValue("sku,freeQty\nY001,50");

    const { res } = await invokeRoute(route, "get", "/:slug.csv", {
      params: { slug: "stock-report" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/csv");
    expect(res.body).toContain("Y001");
  });
});
