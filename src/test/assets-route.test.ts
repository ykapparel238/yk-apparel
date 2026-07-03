import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  style: { findUnique: vi.fn() },
  styleSample: { findUnique: vi.fn() },
  purchaseOrder: { findUnique: vi.fn() },
  fileAsset: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  styleSampleAsset: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
};

const writeAuditLog = vi.fn();
const writeAssetBinary = vi.fn();
const deleteAssetBinary = vi.fn();

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog }));
vi.mock("../../server/storage.mjs", () => ({
  writeAssetBinary,
  deleteAssetBinary,
  toPublicAssetUrl: (storagePath: string) => `/uploads/${storagePath}`,
}));

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
  }
  return { req, res };
}

describe("assets route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a style asset and writes an audit log", async () => {
    const route = (await import("../../server/routes/assets.mjs")).default;
    prisma.style.findUnique.mockResolvedValue({ id: "style-1", code: "ST-1" });
    writeAssetBinary.mockResolvedValue({
      storagePath: "style/style-1/front.jpg",
      publicUrl: "/uploads/style/style-1/front.jpg",
    });
    prisma.fileAsset.create.mockResolvedValue({
      id: "asset-1",
      entityType: "STYLE",
      entityId: "style-1",
      kind: "SAMPLE_IMAGE",
      originalName: "front.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 4,
      storagePath: "style/style-1/front.jpg",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { res } = await invokeRoute(route, "post", "/", {
      body: {
        entityType: "STYLE",
        entityId: "style-1",
        kind: "SAMPLE_IMAGE",
        fileName: "front.jpg",
        mimeType: "image/jpeg",
        dataBase64: Buffer.from("test").toString("base64"),
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.item).toMatchObject({
      id: "asset-1",
      fileName: "front.jpg",
      kind: "SAMPLE_IMAGE",
    });
    expect(writeAssetBinary).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        module: "assets",
        action: "CREATE",
        targetType: "FileAsset",
      }),
    );
  });

  it("allows production users to upload PO report photos", async () => {
    const route = (await import("../../server/routes/assets.mjs")).default;
    prisma.purchaseOrder.findUnique.mockResolvedValue({ id: "ord-1", poNumber: "PO-1" });
    writeAssetBinary.mockResolvedValue({
      storagePath: "order/ord-1/cutting-report.jpg",
      publicUrl: "/uploads/order/ord-1/cutting-report.jpg",
    });
    prisma.fileAsset.create.mockResolvedValue({
      id: "asset-po-1",
      entityType: "ORDER",
      entityId: "ord-1",
      kind: "ATTACHMENT",
      context: "CUTTING_REPORT",
      caption: "Morning cutting sheet",
      sourceType: "production_entry",
      sourceId: "entry-1",
      originalName: "cutting-report.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 4,
      storagePath: "order/ord-1/cutting-report.jpg",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { res } = await invokeRoute(route, "post", "/", {
      sessionUser: { id: "u2", role: "LINE_SUPERVISOR" },
      body: {
        entityType: "ORDER",
        entityId: "ord-1",
        kind: "ATTACHMENT",
        context: "CUTTING_REPORT",
        caption: "Morning cutting sheet",
        sourceType: "production_entry",
        sourceId: "entry-1",
        fileName: "cutting-report.jpg",
        mimeType: "image/jpeg",
        dataBase64: Buffer.from("test").toString("base64"),
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.item).toMatchObject({
      entityType: "ORDER",
      context: "CUTTING_REPORT",
      caption: "Morning cutting sheet",
    });
    expect(prisma.fileAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        context: "CUTTING_REPORT",
        uploadedByUserId: "u2",
      }),
    });
  });

  it("returns uploaded asset metadata", async () => {
    const route = (await import("../../server/routes/assets.mjs")).default;
    prisma.fileAsset.findUnique.mockResolvedValue({
      id: "asset-1",
      entityType: "STYLE",
      entityId: "style-1",
      kind: "ATTACHMENT",
      originalName: "spec.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      storagePath: "style/style-1/spec.pdf",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { res } = await invokeRoute(route, "get", "/:id", {
      params: { id: "asset-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.item.fileName).toBe("spec.pdf");
  });
});
