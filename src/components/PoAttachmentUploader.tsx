import { useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadPoAttachment, type PendingPoUpload } from "@/lib/assetUploads";
import type { FileAssetItem, PoAttachmentContext } from "@/lib/types";
import { poAttachmentContexts } from "@/lib/poAttachmentContexts";
import { toast } from "sonner";

type Props = {
  orderId?: string;
  value?: PendingPoUpload[];
  onChange?: (uploads: PendingPoUpload[]) => void;
  onUploaded?: (asset: FileAssetItem) => void;
  contexts?: PoAttachmentContext[];
  defaultContext?: PoAttachmentContext;
  sourceType?: string;
  sourceId?: string | null;
  title?: string;
  compact?: boolean;
};

export function PoAttachmentUploader({
  orderId,
  value = [],
  onChange,
  onUploaded,
  contexts,
  defaultContext = "OTHER",
  sourceType,
  sourceId,
  title = "Attach report/photo",
  compact = false,
}: Props) {
  const options = contexts?.length ? poAttachmentContexts.filter((item) => contexts.includes(item.value)) : poAttachmentContexts;
  const [context, setContext] = useState<PoAttachmentContext>(contexts?.[0] ?? defaultContext);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetDraft = () => {
    setCaption("");
    setFile(null);
  };

  const addOrUpload = async () => {
    if (!file) {
      toast.error("Choose a file first");
      return;
    }
    const pending: PendingPoUpload = {
      file,
      context,
      caption,
      sourceType,
      sourceId,
    };

    if (!orderId) {
      onChange?.([...value, pending]);
      resetDraft();
      return;
    }

    try {
      setIsUploading(true);
      const asset = await uploadPoAttachment(orderId, pending);
      onUploaded?.(asset);
      toast.success("File uploaded", { description: asset.fileName });
      resetDraft();
    } catch (error) {
      toast.error("Unable to upload file", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removePending = (index: number) => {
    onChange?.(value.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-xs font-medium mb-2">{title}</div>
      <div className={compact ? "space-y-2" : "grid gap-2 sm:grid-cols-[1fr_140px]"}>
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="h-9 bg-background text-xs"
        />
        <Select value={context} onValueChange={(value) => setContext(value as PoAttachmentContext)}>
          <SelectTrigger className="h-9 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Optional note"
          className="h-9 bg-background text-xs"
        />
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" disabled={isUploading} onClick={addOrUpload}>
          <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
          {orderId ? (isUploading ? "Uploading..." : "Upload") : "Add"}
        </Button>
      </div>
      {!orderId && value.length ? (
        <div className="mt-3 space-y-1.5">
          {value.map((item, index) => (
            <div key={`${item.file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
              <span className="text-muted-foreground">{item.context.replaceAll("_", " ")}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePending(index)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">Images are compressed before upload. PDFs are kept as documents.</p>
    </div>
  );
}
