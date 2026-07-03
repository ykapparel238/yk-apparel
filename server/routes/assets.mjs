import { Router } from "express";
import { z } from "zod";
import { writeAuditLog } from "../audit.mjs";
import { prisma } from "../db.mjs";
import { ApiError, asyncHandler, fail, ok, requireRoles } from "../http.mjs";
import { deleteAssetBinary, writeAssetBinary } from "../storage.mjs";
import { mapFileAsset } from "../style-tech-pack.mjs";

const router = Router();

const createAssetSchema = z.object({
  entityType: z.enum(["STYLE", "STYLE_SAMPLE", "ORDER"]),
  entityId: z.string().min(1),
  kind: z.enum(["SAMPLE_IMAGE", "REFERENCE_IMAGE", "TECH_PACK", "ATTACHMENT"]),
  context: z.enum([
    "SIZE_CHART",
    "SAMPLE_PHOTO",
    "CUTTING_REPORT",
    "STITCHING_REPORT",
    "WASHING_REPORT",
    "QA_REPORT",
    "PACKING_REPORT",
    "DISPATCH_REPORT",
    "OTHER",
  ]).optional(),
  caption: z.string().max(240).optional().default(""),
  sourceType: z.string().max(80).optional().nullable(),
  sourceId: z.string().max(120).optional().nullable(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1),
});

const uploadRoles = [
  "ADMIN",
  "FACTORY_MANAGER",
  "PRODUCTION_PLANNER",
  "MERCHANDISER",
  "QA_MANAGER",
  "STORE_MANAGER",
  "LINE_SUPERVISOR",
  "VENDOR_MANAGER",
  "DISPATCH_MANAGER",
];

function canDeleteAsset(req, asset) {
  if (req.sessionUser?.role === "ADMIN") return true;
  if (!asset.uploadedByUserId || asset.uploadedByUserId !== req.sessionUser?.id) return false;
  const ageMs = Date.now() - asset.createdAt.getTime();
  return ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000;
}

router.post(
  "/",
  requireRoles(...uploadRoles),
  asyncHandler(async (req, res) => {
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, "Invalid asset payload", "INVALID_ASSET_PAYLOAD", parsed.error.flatten());
    }

    const bytes = Buffer.from(parsed.data.dataBase64, "base64");
    const targetExists = await (
      parsed.data.entityType === "STYLE"
        ? prisma.style.findUnique({ where: { id: parsed.data.entityId }, select: { id: true, code: true } })
        : parsed.data.entityType === "STYLE_SAMPLE"
          ? prisma.styleSample.findUnique({ where: { id: parsed.data.entityId }, select: { id: true } })
          : prisma.purchaseOrder.findUnique({ where: { id: parsed.data.entityId }, select: { id: true, poNumber: true } })
    );

    if (!targetExists) {
      return fail(res, 404, "Upload target not found", "ASSET_TARGET_NOT_FOUND");
    }

    const stored = await writeAssetBinary({
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      mimeType: parsed.data.mimeType,
      originalName: parsed.data.fileName,
      bytes,
    });

    const asset = await prisma.fileAsset.create({
      data: {
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        kind: parsed.data.kind,
        context: parsed.data.context ?? null,
        caption: parsed.data.caption?.trim() || null,
        sourceType: parsed.data.sourceType ?? null,
        sourceId: parsed.data.sourceId ?? null,
        originalName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        sizeBytes: bytes.length,
        storagePath: stored.storagePath,
        uploadedByUserId: req.sessionUser?.id ?? null,
      },
    });

    await writeAuditLog(req, {
      module: "assets",
      action: "CREATE",
      targetType: "FileAsset",
      targetId: asset.id,
      targetLabel: parsed.data.fileName,
    });

    return ok(res, { item: mapFileAsset(asset) }, 201);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const asset = await prisma.fileAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      return fail(res, 404, "Asset not found", "ASSET_NOT_FOUND");
    }
    return ok(res, { item: mapFileAsset(asset) });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const asset = await prisma.fileAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) {
      return fail(res, 404, "Asset not found", "ASSET_NOT_FOUND");
    }
    if (!canDeleteAsset(req, asset)) {
      return fail(res, 403, "You do not have permission to delete this asset", "FORBIDDEN");
    }

    await prisma.$transaction(async (tx) => {
      await tx.styleSampleAsset.deleteMany({ where: { assetId: asset.id } });
      await tx.fileAsset.delete({ where: { id: asset.id } });
      await writeAuditLog(req, {
        tx,
        module: "assets",
        action: "DELETE",
        targetType: "FileAsset",
        targetId: asset.id,
        targetLabel: asset.originalName,
      });
    });

    await deleteAssetBinary(asset.storagePath);
    return res.status(204).send();
  }),
);

export default router;
