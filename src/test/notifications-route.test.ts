import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  alert: { findMany: vi.fn() },
  workflowChangeRequest: { findMany: vi.fn() },
  purchaseOrder: { findMany: vi.fn() },
  material: { findMany: vi.fn() },
  qaInspection: { findMany: vi.fn() },
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
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role: "ADMIN", actualRole: "ADMIN" }, ...reqOverrides };
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

describe("notifications route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.alert.findMany.mockResolvedValue([]);
    prisma.workflowChangeRequest.findMany.mockResolvedValue([]);
    prisma.purchaseOrder.findMany.mockResolvedValue([]);
    prisma.material.findMany.mockResolvedValue([]);
    prisma.qaInspection.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("includes pending change requests for admins", async () => {
    const route = (await import("../../server/routes/notifications.mjs")).default;
    prisma.workflowChangeRequest.findMany.mockResolvedValue([
      {
        id: "cr-1",
        module: "orders",
        entityType: "PurchaseOrder",
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
        requester: { name: "Meena" },
      },
    ]);

    const { res } = await invokeRoute(route, "get", "/");

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.items[0]).toMatchObject({ module: "Settings", href: "/settings" });
  });

  it("hides admin change requests from non-admin notifications", async () => {
    const route = (await import("../../server/routes/notifications.mjs")).default;

    const { res } = await invokeRoute(route, "get", "/", {
      sessionUser: { id: "u2", role: "STORE_MANAGER", actualRole: "STORE_MANAGER" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.workflowChangeRequest.findMany).not.toHaveBeenCalled();
  });

  it("includes low-stock material notifications", async () => {
    const route = (await import("../../server/routes/notifications.mjs")).default;
    prisma.material.findMany.mockResolvedValue([
      { id: "mat-1", sku: "Y001", stockQty: "10.00", reorderLevel: "25.00", updatedAt: new Date("2026-05-01T10:00:00.000Z") },
    ]);

    const { res } = await invokeRoute(route, "get", "/");

    expect(res.statusCode).toBe(200);
    expect(res.body.items.some((item) => item.module === "Inventory")).toBe(true);
  });
});
