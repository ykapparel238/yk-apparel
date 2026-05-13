import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  const env = getEnv();
  if (env.UPLOAD_STORAGE_DRIVER === "s3") {
    const key = storagePath.split(path.sep).join("/");
    if (env.S3_ENDPOINT) {
      return `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`;
    }
    return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
  }
  return `/uploads/${storagePath.split(path.sep).join("/")}`;
}

function getS3Config() {
  const env = getEnv();
  const missing = [
    ["S3_BUCKET", env.S3_BUCKET],
    ["S3_REGION", env.S3_REGION],
    ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
    ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
  ].filter(([, value]) => !value);

  if (missing.length) {
    throw new ApiError(500, "S3 storage is not configured", "S3_STORAGE_NOT_CONFIGURED", {
      missing: missing.map(([key]) => key),
    });
  }

  return {
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  };
}

function createS3Client() {
  const config = getS3Config();
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: config.credentials,
  });
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
  const ext = extensionForMimeType(mimeType);
  const fileName = `${sanitizeFileSegment(path.parse(originalName).name)}-${randomUUID()}.${ext}`;
  const relativeDir = path.join(entityType.toLowerCase(), sanitizeFileSegment(entityId));

  if (env.UPLOAD_STORAGE_DRIVER === "s3") {
    const config = getS3Config();
    const storagePath = path.posix.join(entityType.toLowerCase(), sanitizeFileSegment(entityId), fileName);
    await createS3Client().send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: storagePath,
      Body: bytes,
      ContentType: mimeType,
    }));
    return {
      storagePath,
      publicUrl: toPublicAssetUrl(storagePath),
    };
  }

  ensureUploadDirectory();
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
  if (env.UPLOAD_STORAGE_DRIVER === "s3") {
    const config = getS3Config();
    await createS3Client().send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: storagePath.split(path.sep).join("/"),
    }));
    return;
  }

  const absolutePath = path.join(getUploadLocalDir(), storagePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}
