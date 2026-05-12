import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  brand: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  supplier: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  vendor: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  style: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  styleSize: { deleteMany: vi.fn() },
  styleColor: { deleteMany: vi.fn(), upsert: vi.fn() },
  styleMeasurementSpec: { deleteMany: vi.fn(), createMany: vi.fn() },
  styleThreadSpec: { deleteMany: vi.fn(), createMany: vi.fn() },
  styleSample: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  styleSampleAsset: { createMany: vi.fn(), deleteMany: vi.fn() },
  fileAsset: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  purchaseOrder: { findMany: vi.fn(), count: vi.fn() },
  material: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  billOfMaterialItem: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  productionLine: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  productionPlan: { count: vi.fn() },
  lineDailyMetric: { count: vi.fn() },
  qaInspection: { count: vi.fn() },
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

describe("masters route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects material payloads where allocated exceeds stock", async () => {
    const route = (await import("../../server/routes/masters.mjs")).default;
    const { res } = await invokeRoute(route, "post", "/materials", {
      body: {
        sku: "Y-1",
        name: "Yarn",
        type: "YARN",
        uom: "Kg",
        stockQty: 10,
        allocatedQty: 12,
        reorderLevel: 5,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_MATERIAL_PAYLOAD");
    expect(prisma.material.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate BOM items for the same style and material", async () => {
    const route = (await import("../../server/routes/masters.mjs")).default;
    prisma.billOfMaterialItem.findFirst.mockResolvedValue({ id: "bom-1" });

    const { res } = await invokeRoute(route, "post", "/bom-items", {
      body: {
        styleId: "style-1",
        materialId: "mat-1",
        quantityPerPiece: 0.42,
        uom: "Kg",
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      code: "DUPLICATE_BOM_ITEM",
    });
  });

  it("blocks line deletion when execution records exist", async () => {
    const route = (await import("../../server/routes/masters.mjs")).default;
    prisma.productionPlan.count.mockResolvedValue(1);
    prisma.lineDailyMetric.count.mockResolvedValue(0);
    prisma.qaInspection.count.mockResolvedValue(0);
    prisma.productionLine.findUnique.mockResolvedValue({
      id: "line-1",
      name: "Knitting Line 1",
    });

    const { res } = await invokeRoute(route, "delete", "/lines/:id", {
      params: { id: "line-1" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("LINE_IN_USE");
    expect(prisma.productionLine.delete).not.toHaveBeenCalled();
  });

  it("returns style tech pack data", async () => {
    const route = (await import("../../server/routes/masters.mjs")).default;
    prisma.style.findUnique
      .mockResolvedValueOnce({ id: "style-1" })
      .mockResolvedValueOnce({
        id: "style-1",
        colors: [{ id: "c1", name: "Navy", hexCode: "#112233", pantoneCode: "19-3921", threadCode: "TH-1", notes: "Body" }],
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
          materialName: "Cotton 2/30s",
          countSpec: "2/30s",
          colorRef: "Navy",
          supplierId: null,
          materialId: null,
          processNotes: "Body yarn",
          sortOrder: 1,
        }],
      });
    prisma.fileAsset.findMany.mockResolvedValue([{
      id: "asset-1",
      entityType: "STYLE",
      entityId: "style-1",
      kind: "SAMPLE_IMAGE",
      originalName: "front.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      storagePath: "style/style-1/front.jpg",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }]);

    const { res } = await invokeRoute(route, "get", "/styles/:id/tech-pack", {
      params: { id: "style-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      styleId: "style-1",
      assets: [{ id: "asset-1", fileName: "front.jpg" }],
      measurements: [{ sizeLabel: "M", measurementPoint: "Chest" }],
      threadSpecs: [{ materialName: "Cotton 2/30s" }],
      colorways: [{ name: "Navy", threadCode: "TH-1" }],
    });
  });

  it("replaces measurements and thread specs when patching a tech pack", async () => {
    const route = (await import("../../server/routes/masters.mjs")).default;
    prisma.style.findUnique
      .mockResolvedValueOnce({ id: "style-1", code: "ST-1" })
      .mockResolvedValueOnce({ id: "style-1" })
      .mockResolvedValueOnce({
        id: "style-1",
        colors: [],
        samples: [],
        measurementSpecs: [],
        threadSpecs: [],
      });
    prisma.fileAsset.findMany.mockResolvedValue([]);

    const { res } = await invokeRoute(route, "patch", "/styles/:id/tech-pack", {
      params: { id: "style-1" },
      body: {
        measurements: [{ sizeLabel: "M", measurementPoint: "Chest", targetValue: 42, tolerancePlus: 0.5, toleranceMinus: 0.5, unit: "in" }],
        threadSpecs: [{ materialName: "Cotton", countSpec: "2/30s", colorRef: "Navy", supplierId: null, materialId: null, processNotes: "Body", sortOrder: 1 }],
        colorways: [{ name: "Navy", hexCode: "#112233", pantoneCode: "19-3921", threadCode: "TH-1", notes: "Body" }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.styleMeasurementSpec.deleteMany).toHaveBeenCalledWith({ where: { styleId: "style-1" } });
    expect(prisma.styleThreadSpec.createMany).toHaveBeenCalled();
    expect(prisma.styleColor.upsert).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        module: "masters",
        action: "UPDATE",
        targetType: "StyleTechPack",
        targetId: "style-1",
      }),
    );
  });

  it("creates a style sample and writes an audit log", async () => {
    const route = (await import("../../server/routes/masters.mjs")).default;
    prisma.style.findUnique.mockResolvedValue({ id: "style-1", code: "ST-1" });
    prisma.styleSample.create.mockResolvedValue({ id: "sample-1" });
    prisma.style.findUnique.mockResolvedValueOnce({ id: "style-1", code: "ST-1" }).mockResolvedValueOnce({
      id: "style-1",
      colors: [],
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
    });
    prisma.fileAsset.findMany.mockResolvedValue([]);

    const { res } = await invokeRoute(route, "post", "/styles/:id/samples", {
      params: { id: "style-1" },
      body: {
        sampleType: "PROTO",
        status: "APPROVED",
        notes: "Approved",
        assetIds: [],
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.styleSample.create).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        module: "masters",
        action: "CREATE",
        targetType: "StyleSample",
      }),
    );
  });
});
