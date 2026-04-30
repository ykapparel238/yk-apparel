import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  vendor: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  purchaseOrder: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  vendorChallan: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
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
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role: "VENDOR_MANAGER" }, ...reqOverrides };
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

describe("vendor route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects challan updates where inward and rejected exceed outward", async () => {
    const route = (await import("../../server/routes/vendors.mjs")).default;
    prisma.vendorChallan.findFirst.mockResolvedValue({
      id: "ch-1",
      outwardQty: 100,
      order: { poNumber: "PO-1" },
    });

    const { res } = await invokeRoute(route, "patch", "/:id/challans/:challanId", {
      params: { id: "ven-1", challanId: "ch-1" },
      body: { inwardQty: 80, rejectedQty: 30 },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("INVALID_CHALLAN_TOTALS");
  });

  it("updates challan status to closed and writes audit log", async () => {
    const route = (await import("../../server/routes/vendors.mjs")).default;
    prisma.vendorChallan.findFirst.mockResolvedValue({
      id: "ch-1",
      challanNumber: "CH-2401",
      vendorId: "ven-1",
      outwardQty: 100,
      order: { poNumber: "PO-1" },
    });
    prisma.vendorChallan.update.mockResolvedValue({
      id: "ch-1",
      challanNumber: "CH-2401",
      challanDate: new Date("2026-05-01T00:00:00.000Z"),
      orderId: "ord-1",
      outwardQty: 100,
      inwardQty: 95,
      rejectedQty: 5,
      status: "CLOSED",
      order: { poNumber: "PO-1" },
    });

    const { res } = await invokeRoute(route, "patch", "/:id/challans/:challanId", {
      params: { id: "ven-1", challanId: "ch-1" },
      body: { inwardQty: 95, rejectedQty: 5 },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.vendorChallan.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CLOSED" }),
    }));
    expect(writeAuditLog).toHaveBeenCalled();
  });
});
