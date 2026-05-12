import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  purchaseOrder: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  brand: {
    findUnique: vi.fn(),
  },
  style: {
    findUnique: vi.fn(),
  },
  fileAsset: {
    findMany: vi.fn(),
  },
  purchaseOrderSizeAllocation: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  purchaseOrderColorAllocation: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const writeAuditLog = vi.fn();

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog }));

function createRes() {
  const res = {
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
  return res;
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
  };
  return { req, res };
}

describe("orders route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects updates that reduce quantity below delivered qty", async () => {
    const route = (await import("../../server/routes/orders.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-1",
      poNumber: "PO-1",
      deliveredQty: 50,
      brand: { name: "Brand A" },
      style: { code: "ST-1", name: "Style 1" },
    });
    prisma.purchaseOrder.findFirst.mockResolvedValue(null);
    prisma.brand.findUnique.mockResolvedValue({ id: "b1" });
    prisma.style.findUnique.mockResolvedValue({
      id: "s1",
      brandId: "b1",
      sizes: [{ label: "M" }],
      colors: [{ name: "Black", hexCode: "#111111" }],
    });

    await expect(invokeRoute(route, "patch", "/:id", {
      params: { id: "ord-1" },
      body: {
        brandId: "b1",
        styleId: "s1",
        poNumber: "PO-1",
        seasonCode: "AW25",
        quantity: 40,
        dueDate: "2026-05-20",
        priority: "HIGH",
        status: "CREATED",
        sizeAllocations: [{ sizeLabel: "M", percent: 100 }],
        colorAllocations: [{ colorName: "Black", hexCode: "#111111", percent: 100 }],
      },
    })).rejects.toMatchObject({
      message: "Order quantity cannot be lower than already delivered quantity",
      code: "INVALID_ORDER_QUANTITY",
      status: 409,
    });
    expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it("creates orders and writes audit logs", async () => {
    const route = (await import("../../server/routes/orders.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValueOnce(null);
    prisma.brand.findUnique.mockResolvedValue({ id: "b1" });
    prisma.style.findUnique.mockResolvedValue({
      id: "s1",
      brandId: "b1",
      sizes: [{ label: "S" }, { label: "M" }],
      colors: [{ name: "Navy", hexCode: "#123456" }],
    });
    prisma.purchaseOrder.create.mockResolvedValue({
      id: "ord-2",
      poNumber: "PO-2",
      brandId: "b1",
      styleId: "s1",
      seasonCode: "AW25",
      quantity: 120,
      deliveredQty: 0,
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      status: "CREATED",
      priority: "HIGH",
      brand: { name: "Brand A" },
      style: { code: "ST-1", name: "Style 1" },
    });

    const { res } = await invokeRoute(route, "post", "/", {
      body: {
        brandId: "b1",
        styleId: "s1",
        poNumber: "PO-2",
        seasonCode: "AW25",
        quantity: 120,
        dueDate: "2026-05-20",
        priority: "HIGH",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.item.poNumber).toBe("PO-2");
    expect(prisma.purchaseOrder.create).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        module: "orders",
        action: "CREATE",
        targetType: "PurchaseOrder",
        targetLabel: "PO-2",
      }),
    );
  });

  it("includes the style tech pack on order detail", async () => {
    const route = (await import("../../server/routes/orders.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-3",
      poNumber: "PO-3",
      brandId: "b1",
      styleId: "style-1",
      seasonCode: "AW25",
      quantity: 100,
      deliveredQty: 40,
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      status: "QA",
      priority: "HIGH",
      brand: { name: "Brand A" },
      style: {
        id: "style-1",
        code: "ST-1",
        name: "Crew Neck",
        sizes: [{ label: "M" }],
        colors: [{ id: "c1", name: "Navy", hexCode: "#123456", pantoneCode: "19-3921", threadCode: "TH-1", notes: "Body" }],
        bomItems: [],
        samples: [{
          id: "sample-1",
          sampleType: "PROTO",
          status: "APPROVED",
          notes: "Approved",
          approvedByUserId: "u1",
          approvedAt: new Date("2026-01-01T00:00:00.000Z"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          assets: [],
        }],
        measurementSpecs: [{
          id: "m1",
          sizeLabel: "M",
          measurementPoint: "Chest",
          targetValue: 42,
          tolerancePlus: 0.5,
          toleranceMinus: 0.5,
          unit: "in",
        }],
        threadSpecs: [{
          id: "t1",
          materialName: "Cotton",
          countSpec: "2/30s",
          colorRef: "Navy",
          supplierId: null,
          materialId: null,
          processNotes: "Body",
          sortOrder: 1,
        }],
      },
      colorAllocations: [],
      sizeAllocations: [],
      challans: [],
    });
    prisma.fileAsset.findMany.mockResolvedValue([{
      id: "asset-1",
      entityType: "STYLE",
      entityId: "style-1",
      kind: "TECH_PACK",
      originalName: "spec.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      storagePath: "style/style-1/spec.pdf",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }]);

    const { res } = await invokeRoute(route, "get", "/:id", {
      params: { id: "ord-3" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.techPack).toMatchObject({
      styleId: "style-1",
      assets: [{ fileName: "spec.pdf" }],
      measurements: [{ sizeLabel: "M", measurementPoint: "Chest" }],
      threadSpecs: [{ materialName: "Cotton" }],
    });
  });
});
