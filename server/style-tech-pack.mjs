import { toPublicAssetUrl } from "./storage.mjs";

export const styleTechPackInclude = {
  colors: { orderBy: { sortOrder: "asc" } },
  samples: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      assets: {
        include: {
          asset: true,
        },
      },
    },
  },
  measurementSpecs: {
    orderBy: [{ sizeLabel: "asc" }, { measurementPoint: "asc" }],
  },
  threadSpecs: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
} ;

export function mapFileAsset(asset) {
  return {
    id: asset.id,
    entityType: asset.entityType,
    entityId: asset.entityId,
    kind: asset.kind,
    context: asset.context ?? null,
    caption: asset.caption ?? "",
    sourceType: asset.sourceType ?? null,
    sourceId: asset.sourceId ?? null,
    fileName: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    storagePath: asset.storagePath,
    url: toPublicAssetUrl(asset.storagePath),
    createdAt: asset.createdAt.toISOString(),
  };
}

export function mapStyleSample(sample) {
  return {
    id: sample.id,
    sampleType: sample.sampleType,
    status: sample.status,
    notes: sample.notes ?? "",
    approvedByUserId: sample.approvedByUserId ?? null,
    approvedAt: sample.approvedAt ? sample.approvedAt.toISOString() : null,
    createdAt: sample.createdAt.toISOString(),
    assets: sample.assets?.map((link) => mapFileAsset(link.asset)) ?? [],
  };
}

export function mapMeasurementSpec(spec) {
  return {
    id: spec.id,
    sizeLabel: spec.sizeLabel,
    measurementPoint: spec.measurementPoint,
    targetValue: Number(spec.targetValue),
    tolerancePlus: Number(spec.tolerancePlus),
    toleranceMinus: Number(spec.toleranceMinus),
    unit: spec.unit,
  };
}

export function mapThreadSpec(spec) {
  return {
    id: spec.id,
    materialName: spec.materialName,
    countSpec: spec.countSpec,
    colorRef: spec.colorRef ?? "",
    supplierId: spec.supplierId ?? null,
    materialId: spec.materialId ?? null,
    processNotes: spec.processNotes ?? "",
    sortOrder: spec.sortOrder,
  };
}

export function mapStyleColorway(color) {
  return {
    id: color.id,
    name: color.name,
    hexCode: color.hexCode ?? null,
    pantoneCode: color.pantoneCode ?? "",
    threadCode: color.threadCode ?? "",
    notes: color.notes ?? "",
  };
}

export function mapStyleTechPack(style, assets) {
  return {
    styleId: style.id,
    assets: (assets ?? []).map(mapFileAsset),
    samples: (style.samples ?? []).map(mapStyleSample),
    measurements: (style.measurementSpecs ?? []).map(mapMeasurementSpec),
    threadSpecs: (style.threadSpecs ?? []).map(mapThreadSpec),
    colorways: (style.colors ?? []).map(mapStyleColorway),
  };
}
