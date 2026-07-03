import type { PoAttachmentContext } from "@/lib/types";

export const poAttachmentContexts: Array<{ value: PoAttachmentContext; label: string }> = [
  { value: "SIZE_CHART", label: "Size chart" },
  { value: "SAMPLE_PHOTO", label: "Sample photo" },
  { value: "CUTTING_REPORT", label: "Cutting report" },
  { value: "STITCHING_REPORT", label: "Stitching report" },
  { value: "WASHING_REPORT", label: "Washing report" },
  { value: "QA_REPORT", label: "QA report" },
  { value: "PACKING_REPORT", label: "Packing report" },
  { value: "DISPATCH_REPORT", label: "Dispatch report" },
  { value: "OTHER", label: "Other" },
];

export function poAttachmentLabel(context?: string | null) {
  return poAttachmentContexts.find((item) => item.value === context)?.label ?? "Other";
}
