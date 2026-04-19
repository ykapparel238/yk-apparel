import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  brand: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  supplier: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  vendor: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  style: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  styleSize: { deleteMany: vi.fn() },
  styleColor: { deleteMany: vi.fn() },
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
});
