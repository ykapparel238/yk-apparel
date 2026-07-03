import { uploadAsset } from "@/lib/services";
import type { FileAssetItem, PoAttachmentContext } from "@/lib/types";

const MAX_IMAGE_SIDE = 1600;
const IMAGE_QUALITY = 0.78;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export type PendingPoUpload = {
  file: File;
  context: PoAttachmentContext;
  caption?: string;
  sourceType?: string | null;
  sourceId?: string | null;
};

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image"));
    image.src = src;
  });
}

async function compressImage(file: File) {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression is not supported in this browser");
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY));
  if (!blob) throw new Error("Unable to compress image");
  const fileName = file.name.replace(/\.[^.]+$/, "") || "upload";
  return new File([blob], `${fileName}.jpg`, { type: "image/jpeg" });
}

export async function prepareUploadFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, WebP, and PDF files can be uploaded.");
  }
  const prepared = file.type.startsWith("image/") ? await compressImage(file) : file;
  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error("File is too large after compression. Keep uploads under 5 MB.");
  }
  return prepared;
}

export async function uploadPoAttachment(orderId: string, pending: PendingPoUpload): Promise<FileAssetItem> {
  const prepared = await prepareUploadFile(pending.file);
  const dataUrl = await readAsDataUrl(prepared);
  const [, dataBase64 = ""] = dataUrl.split(",");
  const kind = pending.context === "SAMPLE_PHOTO" ? "SAMPLE_IMAGE" : pending.context === "SIZE_CHART" ? "TECH_PACK" : "ATTACHMENT";
  const result = await uploadAsset({
    entityType: "ORDER",
    entityId: orderId,
    kind,
    context: pending.context,
    caption: pending.caption,
    sourceType: pending.sourceType,
    sourceId: pending.sourceId,
    fileName: prepared.name,
    mimeType: prepared.type,
    dataBase64,
  });
  return result.item;
}

export async function uploadPoAttachments(orderId: string, uploads: PendingPoUpload[]) {
  const results: FileAssetItem[] = [];
  for (const upload of uploads) {
    results.push(await uploadPoAttachment(orderId, upload));
  }
  return results;
}
