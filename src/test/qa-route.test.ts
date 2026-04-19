import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  qaInspection: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  vendor: {
    findMany: vi.fn(),
  },
  qaInspectionDefect: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  purchaseOrder: {
    findMany: vi.fn(),
  },
  productionLine: {
    findMany: vi.fn(),
  },
  qaDefectType: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const writeAuditLog = vi.fn();

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog }));

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
    send(payload) {
      this.body = payload ?? null;
      return this;
    },
  };
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
  }
  return { req, res };
}

describe("qa route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => {
      if (typeof callback === "function") return callback(prisma);
      return Promise.all(callback);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid inspection dates", async () => {
    const route = (await import("../../server/routes/qa.mjs")).default;

    const { res } = await invokeRoute(route, "post", "/inspections", {
      body: {
        inspectedAt: "not-a-date",
        stage: "QUALITY_CHECK",
        checkedQty: 10,
        approvedQty: 8,
        rejectedQty: 2,
        reworkQty: 0,
        defects: [],
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_INSPECTION_DATE");
    expect(prisma.qaInspection.create).not.toHaveBeenCalled();
  });

  it("rejects invalid inspection totals", async () => {
    const route = (await import("../../server/routes/qa.mjs")).default;

    const { res } = await invokeRoute(route, "post", "/inspections", {
      body: {
        inspectedAt: "2026-05-02",
        stage: "QUALITY_CHECK",
        checkedQty: 10,
        approvedQty: 9,
        rejectedQty: 3,
        reworkQty: 0,
        defects: [],
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("INVALID_QA_TOTALS");
    expect(prisma.qaInspection.create).not.toHaveBeenCalled();
  });

  it("creates inspections, persists defects, and writes audit logs", async () => {
    const route = (await import("../../server/routes/qa.mjs")).default;
    prisma.qaInspection.create.mockResolvedValue({ id: "ins-1" });
    prisma.qaInspectionDefect.createMany.mockResolvedValue({ count: 1 });

    const { res } = await invokeRoute(route, "post", "/inspections", {
      body: {
        inspectedAt: "2026-05-02",
        orderId: "ord-1",
        vendorId: "ven-1",
        stage: "QUALITY_CHECK",
        checkedQty: 10,
        approvedQty: 8,
        rejectedQty: 1,
        reworkQty: 1,
        defects: [{ defectTypeId: "def-1", count: 1 }],
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.qaInspection.create).toHaveBeenCalled();
    expect(prisma.qaInspectionDefect.createMany).toHaveBeenCalledWith({
      data: [{ inspectionId: "ins-1", defectTypeId: "def-1", count: 1 }],
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "Created inspection" }));
  });

  it("updates inspections and rewrites defects", async () => {
    const route = (await import("../../server/routes/qa.mjs")).default;
    prisma.qaInspection.findUnique.mockResolvedValue({ id: "ins-1" });
    prisma.qaInspection.update.mockResolvedValue({ id: "ins-1" });
    prisma.qaInspectionDefect.deleteMany.mockResolvedValue({ count: 1 });
    prisma.qaInspectionDefect.createMany.mockResolvedValue({ count: 1 });

    const { res } = await invokeRoute(route, "patch", "/inspections/:id", {
      params: { id: "ins-1" },
      body: {
        inspectedAt: "2026-05-03",
        lineId: "line-1",
        stage: "FINISHING",
        checkedQty: 12,
        approvedQty: 10,
        rejectedQty: 1,
        reworkQty: 1,
        defects: [{ defectTypeId: "def-2", count: 1 }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.qaInspection.update).toHaveBeenCalled();
    expect(prisma.qaInspectionDefect.deleteMany).toHaveBeenCalledWith({ where: { inspectionId: "ins-1" } });
    expect(prisma.qaInspectionDefect.createMany).toHaveBeenCalledWith({
      data: [{ inspectionId: "ins-1", defectTypeId: "def-2", count: 1 }],
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "Updated inspection" }));
  });

  it("returns stable summary and defect aggregation payloads", async () => {
    const route = (await import("../../server/routes/qa.mjs")).default;
    prisma.qaInspection.findMany.mockResolvedValue([
      {
        id: "ins-1",
        inspectedAt: new Date("2026-05-03T00:00:00.000Z"),
        stage: "QUALITY_CHECK",
        orderId: "ord-1",
        vendorId: "ven-1",
        lineId: null,
        checkedQty: 10,
        approvedQty: 8,
        rejectedQty: 1,
        reworkQty: 1,
        order: { id: "ord-1", poNumber: "PO-1" },
        vendor: { id: "ven-1", name: "Vendor A" },
        line: null,
        defects: [{ defectTypeId: "def-1", defectType: { name: "Shade Variation" }, count: 1 }],
      },
    ]);
    prisma.vendor.findMany.mockResolvedValue([
      { id: "ven-1", name: "Vendor A", process: "Dyeing", weeklyMetrics: [{ qualityPct: 97 }] },
    ]);
    prisma.qaInspectionDefect.findMany.mockResolvedValue([
      { defectType: { name: "Shade Variation" }, count: 1 },
    ]);
    prisma.purchaseOrder.findMany.mockResolvedValue([{ id: "ord-1", poNumber: "PO-1" }]);
    prisma.productionLine.findMany.mockResolvedValue([{ id: "line-1", name: "Line 1" }]);
    prisma.qaDefectType.findMany.mockResolvedValue([{ id: "def-1", name: "Shade Variation" }]);

    const { res } = await invokeRoute(route, "get", "/");

    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toEqual({ checked: 10, approved: 8, rejected: 1, rework: 1 });
    expect(res.body.defects).toEqual([{ type: "Shade Variation", count: 1, pct: 100 }]);
    expect(res.body.inspections[0]).toMatchObject({
      id: "ins-1",
      orderPo: "PO-1",
      vendorName: "Vendor A",
    });
  });
});
