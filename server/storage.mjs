import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getEnv } from "./env.mjs";
import { ApiError } from "./http.mjs";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function extensionForMimeType(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

function sanitizeFileSegment(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";
}

export function getUploadLocalDir() {
  const env = getEnv();
  return path.resolve(process.cwd(), env.UPLOAD_LOCAL_DIR);
}

export function ensureUploadDirectory() {
  fs.mkdirSync(getUploadLocalDir(), { recursive: true });
}

export function toPublicAssetUrl(storagePath) {
  return `/uploads/${storagePath.split(path.sep).join("/")}`;
}

export function validateAssetPayload({ mimeType, sizeBytes }) {
  const env = getEnv();

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new ApiError(400, "Unsupported asset type", "UNSUPPORTED_ASSET_TYPE", {
      mimeType,
      allowed: Array.from(ALLOWED_MIME_TYPES),
    });
  }

  if (sizeBytes > env.UPLOAD_MAX_BYTES) {
    throw new ApiError(400, "Asset exceeds maximum size", "ASSET_TOO_LARGE", {
      sizeBytes,
      maxBytes: env.UPLOAD_MAX_BYTES,
    });
  }
}

export async function writeAssetBinary({ entityType, entityId, mimeType, originalName, bytes }) {
  const env = getEnv();
  validateAssetPayload({ mimeType, sizeBytes: bytes.length });

  if (env.UPLOAD_STORAGE_DRIVER !== "local") {
    throw new ApiError(501, "S3 storage is not configured in this workspace", "S3_STORAGE_NOT_CONFIGURED");
  }

  ensureUploadDirectory();
  const ext = extensionForMimeType(mimeType);
  const fileName = `${sanitizeFileSegment(path.parse(originalName).name)}-${randomUUID()}.${ext}`;
  const relativeDir = path.join(entityType.toLowerCase(), sanitizeFileSegment(entityId));
  const absoluteDir = path.join(getUploadLocalDir(), relativeDir);
  fs.mkdirSync(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, fileName);
  fs.writeFileSync(absolutePath, bytes);
  return {
    storagePath: path.join(relativeDir, fileName),
    publicUrl: toPublicAssetUrl(path.join(relativeDir, fileName)),
  };
}

export async function deleteAssetBinary(storagePath) {
  const env = getEnv();
  if (env.UPLOAD_STORAGE_DRIVER !== "local") return;

  const absolutePath = path.join(getUploadLocalDir(), storagePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}
