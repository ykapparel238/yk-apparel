import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  desktopDevice: {
    upsert: vi.fn(),
  },
  processedBundle: {
    findUnique: vi.fn(),
  },
  syncCheckpoint: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  syncConflict: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  purchaseOrder: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  purchaseOrderSizeAllocation: {
    findFirst: vi.fn(),
  },
  purchaseOrderColorAllocation: {
    findFirst: vi.fn(),
  },
  brand: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  style: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  vendorChallan: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  productionPlan: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  productionLine: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  lineDailyMetric: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  material: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  procurementRequest: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  qaInspection: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  qaInspectionDefect: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  qaDefectType: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  vendor: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  vendorWeeklyMetric: {
    findFirst: vi.fn(),
  },
  dispatchShipment: {
    findFirst: vi.fn(),
  },
  billOfMaterialItem: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../../server/routes/orders.mjs", () => ({
  buildDefaultColorAllocations: vi.fn(() => []),
  buildDefaultSizeAllocations: vi.fn(() => []),
  normaliseOrderInput: vi.fn((value) => value),
  validateAllocationTotal: vi.fn(),
}));
vi.mock("../../server/routes/planning.mjs", () => ({
  calculateDailyTarget: vi.fn(() => 100),
  toUtcDate: vi.fn((value) => new Date(value)),
}));
vi.mock("../../server/routes/mrp.mjs", () => ({
  buildMrpItems: vi.fn(() => []),
}));

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
    headers: {},
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

describe("sync route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.desktopDevice.upsert.mockResolvedValue({
      id: "device-1",
      status: "ACTIVE",
      rebuildRequired: false,
    });
    prisma.processedBundle.findUnique.mockResolvedValue({ id: "pb-1", bundleId: "bundle-1" });
    prisma.syncConflict.findMany.mockResolvedValue([]);
  });

  it("rejects outdated desktop clients", async () => {
    const route = (await import("../../server/routes/sync.mjs")).default;
    const { res } = await invokeRoute(route, "get", "/pull", {
      headers: {
        "x-desktop-client-version": "0.8.0",
        "x-desktop-device-id": "device-1",
      },
    });

    expect(res.statusCode).toBe(426);
    expect(res.body.code).toBe("CLIENT_TOO_OLD");
  });

  it("skips already-processed bundles idempotently", async () => {
    const route = (await import("../../server/routes/sync.mjs")).default;
    const { res } = await invokeRoute(route, "post", "/push", {
      headers: {
        "x-desktop-client-version": "1.0.0",
        "x-desktop-device-id": "device-1",
      },
      body: {
        bundles: [{
          bundleId: "bundle-1",
          deviceId: "device-1",
          workspaceId: "default",
          entityType: "order",
          entityId: "ord-1",
          operationType: "orders.update",
          createdAt: new Date().toISOString(),
          mutations: [{
            mutationId: "mut-1",
            bundleId: "bundle-1",
            deviceId: "device-1",
            workspaceId: "default",
            entityType: "order",
            entityId: "ord-1",
            operationType: "orders.update",
            payload: { poNumber: "PO-1" },
            createdAt: new Date().toISOString(),
          }],
        }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.results[0].status).toBe("skipped");
  });

  it("returns locked entitlement state in pull responses", async () => {
    prisma.desktopDevice.upsert.mockResolvedValue({
      id: "device-1",
      status: "LOCKED",
      rebuildRequired: false,
    });
    prisma.syncCheckpoint.create.mockResolvedValue({ checkpointId: "cp-1" });

    const route = (await import("../../server/routes/sync.mjs")).default;
    const { res } = await invokeRoute(route, "get", "/pull", {
      headers: {
        "x-desktop-client-version": "1.0.0",
        "x-desktop-device-id": "device-1",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.entitlement.state).toBe("locked");
  });

  it("resolves conflicts for the active device", async () => {
    prisma.syncConflict.findUnique.mockResolvedValue({
      id: "conflict-1",
      deviceId: "device-1",
    });

    const route = (await import("../../server/routes/sync.mjs")).default;
    const { res } = await invokeRoute(route, "post", "/conflicts/:id/resolve", {
      headers: {
        "x-desktop-client-version": "1.0.0",
        "x-desktop-device-id": "device-1",
      },
      params: { id: "conflict-1" },
      body: { choice: "dismiss", rationale: "handled" },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.syncConflict.delete).toHaveBeenCalledWith({ where: { id: "conflict-1" } });
  });
});
