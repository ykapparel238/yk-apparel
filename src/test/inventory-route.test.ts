import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  material: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  procurementRequest: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  supplierPurchaseOrder: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  supplierPurchaseOrderLine: {
    update: vi.fn(),
  },
  goodsReceipt: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  goodsReceiptLine: {
    create: vi.fn(),
  },
  billOfMaterialItem: {
    findMany: vi.fn(),
  },
  purchaseOrder: {
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
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role: "STORE_MANAGER" }, ...reqOverrides };
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

describe("inventory route", () => {
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

  it("rejects stock adjustments that go below allocated quantity", async () => {
    const route = (await import("../../server/routes/inventory.mjs")).default;
    prisma.material.findUnique.mockResolvedValue({
      id: "mat-1",
      sku: "Y001",
      stockQty: "100.00",
      allocatedQty: "80.00",
      supplier: null,
    });

    const { res } = await invokeRoute(route, "post", "/adjustments", {
      body: { sku: "Y001", deltaQty: -30, reason: "Issue" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("ALLOCATED_STOCK_CONFLICT");
  });

  it("updates stock and writes audit log", async () => {
    const route = (await import("../../server/routes/inventory.mjs")).default;
    prisma.material.findUnique.mockResolvedValue({
      id: "mat-1",
      sku: "Y001",
      name: "Cotton Yarn",
      type: "YARN",
      uom: "Kg",
      stockQty: "100.00",
      allocatedQty: "20.00",
      reorderLevel: "40.00",
      supplier: { name: "Vardhman" },
    });
    prisma.material.update.mockResolvedValue({
      id: "mat-1",
      sku: "Y001",
      name: "Cotton Yarn",
      type: "YARN",
      uom: "Kg",
      stockQty: "130.00",
      allocatedQty: "20.00",
      reorderLevel: "40.00",
      supplier: { name: "Vardhman" },
    });

    const { res } = await invokeRoute(route, "post", "/adjustments", {
      body: { sku: "Y001", deltaQty: 30, reason: "GRN" },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.material.update).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("creates procurement request only for shortage materials", async () => {
    const route = (await import("../../server/routes/inventory.mjs")).default;
    prisma.material.findUnique.mockResolvedValue({
      id: "mat-2",
      sku: "Y002",
      name: "Acrylic Yarn",
      stockQty: "3200.00",
      allocatedQty: "2800.00",
      supplierId: "sup-1",
      supplier: { name: "Nahar" },
    });
    prisma.procurementRequest.findFirst.mockResolvedValue(null);
    prisma.billOfMaterialItem.findMany.mockResolvedValue([
      { styleId: "style-1", materialId: "mat-2", quantityPerPiece: "0.38" },
    ]);
    prisma.purchaseOrder.findMany.mockResolvedValue([
      { styleId: "style-1", quantity: 24000, deliveredQty: 16800 },
    ]);
    prisma.procurementRequest.create.mockResolvedValue({
      id: "pr-1",
      materialId: "mat-2",
      shortageQty: "2736.00",
      requestedQty: "2400.00",
      note: "Raise supplier action",
      status: "OPEN",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      supplier: { name: "Nahar" },
      material: { sku: "Y002", name: "Acrylic Yarn", supplier: { name: "Nahar" } },
      createdBy: { name: "Prakash" },
    });

    const { res } = await invokeRoute(route, "post", "/procurement-requests", {
      body: { materialId: "mat-2", requestedQty: 2400, note: "Raise supplier action" },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.procurementRequest.create).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("rejects procurement requests when no active shortage exists", async () => {
    const route = (await import("../../server/routes/inventory.mjs")).default;
    prisma.material.findUnique.mockResolvedValue({
      id: "mat-1",
      sku: "Y001",
      name: "Cotton Yarn",
      stockQty: "100.00",
      allocatedQty: "0.00",
      supplierId: "sup-1",
      supplier: { name: "Vardhman" },
    });
    prisma.procurementRequest.findFirst.mockResolvedValue(null);
    prisma.billOfMaterialItem.findMany.mockResolvedValue([
      { styleId: "style-1", materialId: "mat-1", quantityPerPiece: "0.2" },
    ]);
    prisma.purchaseOrder.findMany.mockResolvedValue([]);

    const { res } = await invokeRoute(route, "post", "/procurement-requests", {
      body: { materialId: "mat-1", requestedQty: 100, note: "No shortage" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("NO_ACTIVE_SHORTAGE");
  });

  it("updates procurement request status", async () => {
    const route = (await import("../../server/routes/inventory.mjs")).default;
    prisma.procurementRequest.findUnique.mockResolvedValue({
      id: "pr-1",
      material: { sku: "Y002", name: "Acrylic Yarn", supplier: { name: "Nahar" } },
      supplier: { name: "Nahar" },
      createdBy: { name: "Prakash" },
    });
    prisma.procurementRequest.update.mockResolvedValue({
      id: "pr-1",
      materialId: "mat-2",
      shortageQty: "2336.00",
      requestedQty: "2400.00",
      note: "Supplier confirmed",
      status: "IN_PROGRESS",
      createdAt: new Date("2026-04-28T00:00:00.000Z"),
      material: { sku: "Y002", name: "Acrylic Yarn", supplier: { name: "Nahar" } },
      supplier: { name: "Nahar" },
      createdBy: { name: "Prakash" },
    });

    const { res } = await invokeRoute(route, "patch", "/procurement-requests/:id", {
      params: { id: "pr-1" },
      body: { status: "IN_PROGRESS", note: "Supplier confirmed", requestedQty: 2400 },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.procurementRequest.update).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("creates a supplier purchase order from a procurement request", async () => {
    const route = (await import("../../server/routes/inventory.mjs")).default;
    prisma.procurementRequest.findUnique.mockResolvedValue({
      id: "pr-1",
      materialId: "mat-2",
      supplierId: "sup-1",
      note: "Urgent yarn",
      requestedQty: 2400,
      material: { id: "mat-2", sku: "Y002", name: "Acrylic Yarn", uom: "Kg", supplierId: "sup-1" },
      supplier: { id: "sup-1", name: "Nahar" },
    });
    prisma.supplierPurchaseOrder.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ poNumber: "SPO-2401" });
    prisma.supplierPurchaseOrder.create.mockResolvedValue({
      id: "spo-2",
      poNumber: "SPO-2402",
      procurementRequestId: "pr-1",
      supplierId: "sup-1",
      supplier: { name: "Nahar" },
      status: "ISSUED",
      expectedDate: new Date("2026-05-20T00:00:00.000Z"),
      note: "Urgent yarn",
      lines: [
        {
          id: "line-1",
          materialId: "mat-2",
          requestedQty: "2400.00",
          orderedQty: "2500.00",
          receivedQty: "0.00",
          uom: "Kg",
          material: { sku: "Y002", name: "Acrylic Yarn" },
        },
      ],
      receipts: [],
    });
    prisma.procurementRequest.update.mockResolvedValue({});

    const { res } = await invokeRoute(route, "post", "/purchase-orders", {
      body: {
        procurementRequestId: "pr-1",
        orderedQty: 2500,
        expectedDate: "2026-05-20",
        note: "Urgent yarn",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.supplierPurchaseOrder.create).toHaveBeenCalled();
    expect(prisma.procurementRequest.update).toHaveBeenCalledWith({
      where: { id: "pr-1" },
      data: { status: "IN_PROGRESS" },
    });
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("receives supplier goods and updates stock", async () => {
    const route = (await import("../../server/routes/inventory.mjs")).default;
    prisma.supplierPurchaseOrder.findUnique.mockResolvedValue({
      id: "spo-1",
      procurementRequestId: "pr-1",
      lines: [
        {
          id: "pol-1",
          materialId: "mat-2",
          orderedQty: "2500.00",
          receivedQty: "1000.00",
          material: { id: "mat-2", stockQty: "400.00" },
        },
      ],
      supplier: { name: "Nahar" },
      receipts: [],
    });
    prisma.goodsReceipt.findFirst.mockResolvedValue({ receiptNumber: "GRN-2401" });
    prisma.goodsReceipt.create.mockResolvedValue({
      id: "grn-2",
      receiptNumber: "GRN-2402",
    });
    prisma.goodsReceiptLine.create.mockResolvedValue({ id: "grnl-1" });
    prisma.supplierPurchaseOrderLine.update.mockResolvedValue({
      id: "pol-1",
      orderedQty: "2500.00",
      receivedQty: "2500.00",
    });
    prisma.material.update.mockResolvedValue({});
    prisma.supplierPurchaseOrder.update.mockResolvedValue({});
    prisma.procurementRequest.update.mockResolvedValue({});

    const { res } = await invokeRoute(route, "post", "/goods-receipts", {
      body: {
        purchaseOrderId: "spo-1",
        receivedQty: 1500,
        receivedAt: "2026-05-21",
        note: "Delivered",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.goodsReceipt.create).toHaveBeenCalled();
    expect(prisma.material.update).toHaveBeenCalledWith({
      where: { id: "mat-2" },
      data: { stockQty: "1900.00" },
    });
    expect(prisma.supplierPurchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "spo-1" },
      data: { status: "RECEIVED" },
    });
    expect(prisma.procurementRequest.update).toHaveBeenCalledWith({
      where: { id: "pr-1" },
      data: { status: "CLOSED" },
    });
    expect(writeAuditLog).toHaveBeenCalled();
  });
});
