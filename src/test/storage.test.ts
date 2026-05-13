import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  DeleteObjectCommand: class DeleteObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
  S3Client: class S3Client {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
    send(command: unknown) {
      return send(command);
    }
  },
}));

const originalEnv = { ...process.env };

async function loadStorage(env: Record<string, string>) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/knitcraft_mes?schema=public",
    ...env,
  };
  return import("../../server/storage.mjs");
}

describe("asset storage", () => {
  beforeEach(() => {
    send.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("writes local files and returns a public uploads URL", async () => {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "kc-uploads-"));
    const storage = await loadStorage({
      UPLOAD_STORAGE_DRIVER: "local",
      UPLOAD_LOCAL_DIR: uploadDir,
    });

    const result = await storage.writeAssetBinary({
      entityType: "STYLE",
      entityId: "style-1",
      mimeType: "image/png",
      originalName: "front.png",
      bytes: Buffer.from("image"),
    });

    expect(result.publicUrl).toMatch(/^\/uploads\/style\/style-1\/front-/);
    expect(fs.existsSync(path.join(uploadDir, result.storagePath))).toBe(true);
  });

  it("rejects unsupported MIME types and oversize payloads", async () => {
    const storage = await loadStorage({
      UPLOAD_STORAGE_DRIVER: "local",
      UPLOAD_MAX_BYTES: "4",
    });

    expect(() => storage.validateAssetPayload({ mimeType: "text/plain", sizeBytes: 1 })).toThrow("Unsupported asset type");
    expect(() => storage.validateAssetPayload({ mimeType: "image/png", sizeBytes: 5 })).toThrow("Asset exceeds maximum size");
  });

  it("uploads to S3-compatible storage", async () => {
    const storage = await loadStorage({
      UPLOAD_STORAGE_DRIVER: "s3",
      S3_BUCKET: "knitcraft-assets",
      S3_REGION: "us-east-1",
      S3_ENDPOINT: "https://objects.example.com",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
    });

    const result = await storage.writeAssetBinary({
      entityType: "STYLE",
      entityId: "style-1",
      mimeType: "application/pdf",
      originalName: "tech-pack.pdf",
      bytes: Buffer.from("pdf"),
    });

    expect(result.publicUrl).toContain("https://objects.example.com/knitcraft-assets/style/style-1/tech-pack-");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        Bucket: "knitcraft-assets",
        Key: expect.stringMatching(/^style\/style-1\/tech-pack-/),
        ContentType: "application/pdf",
      }),
    }));
  });

  it("deletes S3 objects", async () => {
    const storage = await loadStorage({
      UPLOAD_STORAGE_DRIVER: "s3",
      S3_BUCKET: "knitcraft-assets",
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
    });

    await storage.deleteAssetBinary("style/style-1/spec.pdf");

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        Bucket: "knitcraft-assets",
        Key: "style/style-1/spec.pdf",
      }),
    }));
  });

  it("rejects S3 mode when required config is missing", async () => {
    const storage = await loadStorage({
      UPLOAD_STORAGE_DRIVER: "s3",
      S3_BUCKET: "",
      S3_REGION: "",
      S3_ACCESS_KEY_ID: "",
      S3_SECRET_ACCESS_KEY: "",
    });

    await expect(storage.writeAssetBinary({
      entityType: "STYLE",
      entityId: "style-1",
      mimeType: "image/jpeg",
      originalName: "front.jpg",
      bytes: Buffer.from("image"),
    })).rejects.toMatchObject({ code: "S3_STORAGE_NOT_CONFIGURED" });
  });
});
