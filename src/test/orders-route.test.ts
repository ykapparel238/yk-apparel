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
      productionPlans: [],
      productionEntries: [],
      qaInspections: [],
      shipments: [],
      correctiveActions: [],
      challans: [],
    });
    prisma.fileAsset.findMany.mockResolvedValueOnce([{
      id: "asset-1",
      entityType: "STYLE",
      entityId: "style-1",
      kind: "TECH_PACK",
      originalName: "spec.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      storagePath: "style/style-1/spec.pdf",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }]).mockResolvedValueOnce([{
      id: "asset-order-1",
      entityType: "ORDER",
      entityId: "ord-3",
      kind: "ATTACHMENT",
      context: "QA_REPORT",
      caption: "Inline inspection sheet",
      sourceType: "qa_inspection",
      sourceId: "qa-1",
      originalName: "qa-report.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2000,
      storagePath: "order/ord-3/qa-report.jpg",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
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
    expect(res.body.attachments).toEqual([
      expect.objectContaining({
        fileName: "qa-report.jpg",
        context: "QA_REPORT",
        caption: "Inline inspection sheet",
      }),
    ]);
  });

  it("returns lifecycle blockers for a new order without planning", async () => {
    const route = (await import("../../server/routes/orders.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-4",
      poNumber: "PO-4",
      brandId: "b1",
      styleId: "style-2",
      seasonCode: "AW25",
      quantity: 100,
      deliveredQty: 0,
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      status: "CREATED",
      priority: "MEDIUM",
      brand: { name: "Brand A" },
      style: {
        id: "style-2",
        code: "ST-2",
        name: "Cardigan",
        sizes: [{ label: "M" }],
        colors: [{ name: "Black", hexCode: "#111111" }],
        bomItems: [],
        samples: [],
        measurementSpecs: [],
        threadSpecs: [],
      },
      colorAllocations: [],
      sizeAllocations: [],
      productionPlans: [],
      productionEntries: [],
      qaInspections: [],
      shipments: [],
      correctiveActions: [],
      challans: [],
    });
    prisma.fileAsset.findMany.mockResolvedValue([]);

    const { res } = await invokeRoute(route, "get", "/:id", {
      params: { id: "ord-4" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.lifecycle.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "readiness", status: "blocked" }),
      expect.objectContaining({ key: "planning", status: "blocked" }),
    ]));
    expect(res.body.lifecycle.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ module: "Readiness", message: expect.stringContaining("BOM is missing") }),
      expect.objectContaining({ module: "Planning", message: expect.stringContaining("No production plan") }),
    ]));
  });

  it("reconciles order lifecycle from plan, production, QA, dispatch, CAPA, and shortages", async () => {
    const route = (await import("../../server/routes/orders.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      id: "ord-5",
      poNumber: "PO-5",
      brandId: "b1",
      styleId: "style-3",
      seasonCode: "AW25",
      quantity: 100,
      deliveredQty: 40,
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      status: "QA",
      priority: "HIGH",
      brand: { name: "Brand A" },
      style: {
        id: "style-3",
        code: "ST-3",
        name: "Pullover",
        sizes: [{ label: "M" }],
        colors: [{ name: "Navy", hexCode: "#123456" }],
        bomItems: [{
          id: "bom-1",
          quantityPerPiece: 2,
          uom: "kg",
          material: {
            name: "Cotton Yarn",
            type: "YARN",
            stockQty: 120,
            allocatedQty: 20,
            supplier: { name: "Supplier A" },
          },
        }],
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
        measurementSpecs: [],
        threadSpecs: [],
      },
      colorAllocations: [{ colorName: "Navy", hexCode: "#123456", percent: 100 }],
      sizeAllocations: [{ sizeLabel: "M", percent: 100 }],
      productionPlans: [{
        id: "plan-1",
        orderId: "ord-5",
        lineId: "line-1",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: new Date("2026-05-10T00:00:00.000Z"),
        plannedQty: 100,
        dailyTarget: 10,
        status: "ACTIVE",
        line: { id: "line-1", name: "Line 1" },
      }],
      productionEntries: [{
        id: "entry-1",
        metricDate: new Date("2026-05-02T00:00:00.000Z"),
        createdAt: new Date("2026-05-02T10:00:00.000Z"),
        stage: "KNITTING",
        plannedQty: 80,
        actualQty: 70,
        rejectedQty: 3,
        downtimeMinutes: 15,
      }],
      qaInspections: [{
        id: "qa-1",
        inspectedAt: new Date("2026-05-03T00:00:00.000Z"),
        checkedQty: 50,
        approvedQty: 45,
        rejectedQty: 3,
        reworkQty: 2,
      }],
      shipments: [{
        id: "ship-1",
        dispatchDate: new Date("2026-05-04T00:00:00.000Z"),
        quantity: 40,
        invoiceNumber: "INV-1",
        status: "SCHEDULED",
        createdAt: new Date("2026-05-04T09:00:00.000Z"),
      }],
      correctiveActions: [{ id: "capa-1", status: "OPEN" }],
      challans: [],
    });
    prisma.fileAsset.findMany.mockResolvedValue([]);

    const { res } = await invokeRoute(route, "get", "/:id", {
      params: { id: "ord-5" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.lifecycle.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "planning",
        status: "complete",
        metrics: expect.objectContaining({ lineName: "Line 1", plannedQty: 100, dailyTarget: 10 }),
      }),
      expect.objectContaining({
        key: "production",
        status: "complete",
        metrics: expect.objectContaining({
          actualQty: 70,
          rejectedQty: 3,
          downtimeMinutes: 15,
          stages: [expect.objectContaining({ stage: "KNITTING", actualQty: 70 })],
        }),
      }),
      expect.objectContaining({
        key: "qa",
        status: "blocked",
        metrics: expect.objectContaining({ checkedQty: 50, openCapaCount: 1 }),
      }),
      expect.objectContaining({
        key: "dispatch",
        status: "in_progress",
        metrics: expect.objectContaining({ shippedQty: 40, remainingQty: 60 }),
      }),
    ]));
    expect(res.body.lifecycle.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ module: "Inventory", message: expect.stringContaining("Cotton Yarn short by 100 kg") }),
      expect.objectContaining({ module: "QA", message: expect.stringContaining("1 open CAPA") }),
    ]));
    expect(res.body.lifecycle.nextAction).toMatchObject({
      label: "Add inspection",
      route: "/qa",
      state: { openInspectionForOrderId: "ord-5" },
    });
  });
});
