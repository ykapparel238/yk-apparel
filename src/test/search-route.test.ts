import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  purchaseOrder: { findMany: vi.fn() },
  style: { findMany: vi.fn() },
  vendor: { findMany: vi.fn() },
  supplier: { findMany: vi.fn() },
  material: { findMany: vi.fn() },
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

describe("search route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.purchaseOrder.findMany.mockResolvedValue([]);
    prisma.style.findMany.mockResolvedValue([]);
    prisma.vendor.findMany.mockResolvedValue([]);
    prisma.supplier.findMany.mockResolvedValue([]);
    prisma.material.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires at least two search characters", async () => {
    const route = (await import("../../server/routes/search.mjs")).default;

    const { res } = await invokeRoute(route, "get", "/", { query: { q: "p" } });

    expect(res.statusCode).toBe(200);
    expect(res.body.groups).toEqual([]);
    expect(prisma.purchaseOrder.findMany).not.toHaveBeenCalled();
  });

  it("returns grouped order and material results", async () => {
    const route = (await import("../../server/routes/search.mjs")).default;
    prisma.purchaseOrder.findMany.mockResolvedValue([
      { id: "ord-1", poNumber: "PO-1001", brand: { name: "YK" }, style: { code: "ST-1" } },
    ]);
    prisma.material.findMany.mockResolvedValue([
      { id: "mat-1", sku: "Y001", name: "Cotton Yarn", supplier: { name: "Nahar" } },
    ]);

    const { res } = await invokeRoute(route, "get", "/", { query: { q: "po" } });

    expect(res.statusCode).toBe(200);
    expect(res.body.groups.map((group) => group.module)).toContain("Orders");
    expect(res.body.groups.map((group) => group.module)).toContain("Materials");
    expect(res.body.groups[0].items[0]).toMatchObject({ href: "/orders/ord-1" });
  });

  it("returns report catalog matches", async () => {
    const route = (await import("../../server/routes/search.mjs")).default;

    const { res } = await invokeRoute(route, "get", "/", { query: { q: "stock" } });

    expect(res.statusCode).toBe(200);
    const reports = res.body.groups.find((group) => group.module === "Reports");
    expect(reports?.items[0]).toMatchObject({ title: "Stock Report", href: "/reports" });
  });
});
