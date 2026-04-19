import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  purchaseOrder: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  dispatchShipment: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

describe("dispatch route", () => {
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

  it("lists only dispatch-relevant orders", async () => {
    const route = (await import("../../server/routes/dispatch.mjs")).default;
    prisma.purchaseOrder.findMany.mockResolvedValue([
      {
        id: "ord-1",
        poNumber: "PO-1",
        quantity: 100,
        deliveredQty: 20,
        dueDate: new Date("2026-05-20T00:00:00.000Z"),
        status: "READY_TO_DISPATCH",
        brand: { name: "Brand A" },
        style: { name: "Style A" },
        shipments: [],
      },
    ]);

    const { res } = await invokeRoute(route, "get", "/");

    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ["QA", "READY_TO_DISPATCH", "DISPATCHED"] } },
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("rejects over-dispatch during shipment create", async () => {
    const route = (await import("../../server/routes/dispatch.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-1",
      quantity: 100,
      deliveredQty: 90,
      shipments: [],
      brand: { name: "Brand A" },
      style: { name: "Style A" },
    });

    const { res } = await invokeRoute(route, "post", "/shipments", {
      body: { orderId: "ord-1", dispatchDate: "2026-05-02", quantity: 20, invoiceNumber: "INV-1" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("OVER_DISPATCH");
  });

  it("rejects invalid shipment dates", async () => {
    const route = (await import("../../server/routes/dispatch.mjs")).default;

    const { res } = await invokeRoute(route, "post", "/shipments", {
      body: { orderId: "ord-1", dispatchDate: "not-a-date", quantity: 20, invoiceNumber: "INV-1" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_DISPATCH_DATE");
    expect(prisma.purchaseOrder.findUnique).not.toHaveBeenCalled();
  });

  it("creates shipment, updates delivered qty, and writes audit log", async () => {
    const route = (await import("../../server/routes/dispatch.mjs")).default;
    prisma.purchaseOrder.findUnique
      .mockResolvedValueOnce({
        id: "ord-1",
        poNumber: "PO-1",
        quantity: 100,
        deliveredQty: 20,
        shipments: [],
        brand: { name: "Brand A" },
        style: { name: "Style A" },
      })
      .mockResolvedValueOnce({
        id: "ord-1",
        poNumber: "PO-1",
        quantity: 100,
        deliveredQty: 50,
        dueDate: new Date("2026-05-20T00:00:00.000Z"),
        status: "READY_TO_DISPATCH",
        brand: { name: "Brand A" },
        style: { name: "Style A" },
        shipments: [{ id: "ship-1", shipmentNumber: "SHIP-2402", dispatchDate: new Date("2026-05-02T00:00:00.000Z"), quantity: 30, invoiceNumber: "INV-1" }],
      });
    prisma.dispatchShipment.findFirst.mockResolvedValue(null);
    prisma.dispatchShipment.create.mockResolvedValue({});
    prisma.purchaseOrder.update.mockResolvedValue({});

    const { res } = await invokeRoute(route, "post", "/shipments", {
      body: { orderId: "ord-1", dispatchDate: "2026-05-02", quantity: 30, invoiceNumber: "INV-1" },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "ord-1" },
      data: { deliveredQty: 50, status: "READY_TO_DISPATCH" },
    });
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("updates shipment and recalculates delivered qty", async () => {
    const route = (await import("../../server/routes/dispatch.mjs")).default;
    prisma.dispatchShipment.findUnique.mockResolvedValue({
      id: "ship-1",
      shipmentNumber: "SHIP-2402",
      orderId: "ord-1",
      order: {
        id: "ord-1",
        quantity: 100,
        shipments: [
          { id: "ship-1", quantity: 30 },
          { id: "ship-2", quantity: 20 },
        ],
      },
    });
    prisma.dispatchShipment.update.mockResolvedValue({});
    prisma.purchaseOrder.update.mockResolvedValue({});
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-1",
      poNumber: "PO-1",
      quantity: 100,
      deliveredQty: 60,
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      status: "READY_TO_DISPATCH",
      brand: { name: "Brand A" },
      style: { name: "Style A" },
      shipments: [{ id: "ship-1", dispatchDate: new Date("2026-05-03T00:00:00.000Z"), quantity: 40, invoiceNumber: "INV-2" }],
    });

    const { res } = await invokeRoute(route, "patch", "/shipments/:id", {
      params: { id: "ship-1" },
      body: { dispatchDate: "2026-05-03", quantity: 40, invoiceNumber: "INV-2" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "ord-1" },
      data: { deliveredQty: 60, status: "READY_TO_DISPATCH" },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "Updated shipment" }));
  });
});
