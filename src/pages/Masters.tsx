import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Boxes,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Plus,
  Filter,
  ChevronDown,
  History,
  Link2,
  MoreHorizontal,
  Pencil,
  Power,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Star,
  Tag,
  Archive,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  createBrand,
  createBomItem,
  createLine,
  createMaterial,
  createStyle,
  createStyleSample,
  createSupplier,
  createVendor,
  deleteBrand,
  deleteBomItem,
  deleteLine,
  deleteMaterial,
  deleteStyleAsset,
  deleteStyle,
  deleteSupplier,
  deleteVendor,
  fetchStyleTechPack,
  fetchMastersOptions,
  fetchMastersSummary,
  uploadAsset,
  updateStyleSample,
  updateStyleTechPack,
  updateBomItem,
  updateBrand,
  updateLine,
  updateMaterial,
  updateStyle,
  updateSupplier,
  updateVendor,
} from "@/lib/services";
import type {
  MasterBomItem,
  MasterBrand,
  FileAssetItem,
  MasterLine,
  MasterMaterial,
  MasterStyle,
  MasterSupplier,
  MasterVendor,
  StyleTechPackPayload,
} from "@/lib/types";

const brandSchema = z.object({
  code: z.string().min(2, "Enter a code"),
  name: z.string().min(2, "Enter a name"),
  countryCode: z.string().min(2, "Use a 2-letter country code").max(2, "Use a 2-letter country code"),
});

const supplierSchema = z.object({
  code: z.string().min(2, "Enter a code"),
  name: z.string().min(2, "Enter a name"),
  defaultMaterial: z.string().min(2, "Enter a material"),
  leadTimeDays: z.coerce.number().int().min(0, "Lead time must be zero or more"),
});

const vendorSchema = z.object({
  code: z.string().min(2, "Enter a code"),
  name: z.string().min(2, "Enter a name"),
  process: z.string().min(2, "Enter a process"),
  capacityPerDay: z.coerce.number().int().positive("Enter a valid capacity"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const styleSchema = z.object({
  code: z.string().min(3, "Enter a style code"),
  brandId: z.string().min(1, "Select a brand"),
  name: z.string().min(2, "Enter a description"),
  gauge: z.string().min(2, "Enter a gauge"),
  yarnDescription: z.string().min(2, "Enter a yarn"),
  sizesText: z.string().min(1, "Enter at least one size"),
  colorsText: z.string().min(1, "Enter at least one colour"),
});

type BrandForm = z.infer<typeof brandSchema>;
type SupplierForm = z.infer<typeof supplierSchema>;
type VendorForm = z.infer<typeof vendorSchema>;
type StyleForm = z.infer<typeof styleSchema>;
const materialSchema = z.object({
  sku: z.string().min(2, "Enter a SKU"),
  name: z.string().min(2, "Enter a name"),
  type: z.enum(["YARN", "TRIM", "LABEL", "PACKING", "OTHER"]),
  uom: z.string().min(1, "Enter a UOM"),
  stockQty: z.coerce.number().min(0, "Stock cannot be negative"),
  allocatedQty: z.coerce.number().min(0, "Allocated cannot be negative"),
  reorderLevel: z.coerce.number().min(0, "Reorder level cannot be negative"),
  supplierId: z.string().optional(),
}).refine((value) => value.allocatedQty <= value.stockQty, {
  message: "Allocated cannot exceed stock",
  path: ["allocatedQty"],
});

const bomSchema = z.object({
  styleId: z.string().min(1, "Select a style"),
  materialId: z.string().min(1, "Select a material"),
  quantityPerPiece: z.coerce.number().positive("Enter a valid quantity"),
  uom: z.string().min(1, "Enter a UOM"),
});

const lineSchema = z.object({
  code: z.string().min(1, "Enter a code"),
  name: z.string().min(2, "Enter a name"),
  process: z.string().min(2, "Enter a process"),
  gauge: z.string().min(1, "Enter a gauge"),
  machineCount: z.coerce.number().int().positive("Enter machine count"),
  isActive: z.boolean(),
});

type MaterialForm = z.infer<typeof materialSchema>;
type BomForm = z.infer<typeof bomSchema>;
type LineForm = z.infer<typeof lineSchema>;

type EditorState =
  | { kind: "brand"; mode: "create" | "edit"; item?: MasterBrand }
  | { kind: "supplier"; mode: "create" | "edit"; item?: MasterSupplier }
  | { kind: "vendor"; mode: "create" | "edit"; item?: MasterVendor }
  | { kind: "style"; mode: "create" | "edit"; item?: MasterStyle }
  | { kind: "material"; mode: "create" | "edit"; item?: MasterMaterial }
  | { kind: "bom"; mode: "create" | "edit"; item?: MasterBomItem }
  | { kind: "line"; mode: "create" | "edit"; item?: MasterLine }
  | null;

type DeleteState =
  | { kind: "brand"; item: MasterBrand }
  | { kind: "supplier"; item: MasterSupplier }
  | { kind: "vendor"; item: MasterVendor }
  | { kind: "style"; item: MasterStyle }
  | { kind: "material"; item: MasterMaterial }
  | { kind: "bom"; item: MasterBomItem }
  | { kind: "line"; item: MasterLine }
  | null;

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const styleColorsFromText = (value: string) =>
  splitCsv(value).map((name) => ({ name, hexCode: null }));

const emptyMeasurement = () => ({
  sizeLabel: "",
  measurementPoint: "",
  targetValue: 0,
  tolerancePlus: 0,
  toleranceMinus: 0,
  unit: "in",
});

const emptyThreadSpec = (sortOrder = 1) => ({
  materialName: "",
  countSpec: "",
  colorRef: "",
  supplierId: null as string | null,
  materialId: null as string | null,
  processNotes: "",
  sortOrder,
});

const emptyColorway = () => ({
  name: "",
  hexCode: "",
  pantoneCode: "",
  threadCode: "",
  notes: "",
});

const sampleDefaults = {
  sampleType: "PROTO" as const,
  status: "DRAFT" as const,
  notes: "",
};

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function getDeleteLabel(state: DeleteState) {
  if (!state) return "";
  if (state.kind === "bom") return `${state.item.styleCode} / ${state.item.materialSku}`;
  if ("sku" in state.item) return state.item.sku;
  if ("name" in state.item) return state.item.name;
  return state.item.code;
}

export default function Masters() {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [techPackStyle, setTechPackStyle] = useState<MasterStyle | null>(null);
  const [techPackDraft, setTechPackDraft] = useState<StyleTechPackPayload | null>(null);
  const [sampleDraft, setSampleDraft] = useState(sampleDefaults);
  const [sampleAssetIds, setSampleAssetIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["masters-summary", search],
    queryFn: () => fetchMastersSummary(search),
  });
  const optionsQuery = useQuery({
    queryKey: ["masters-options"],
    queryFn: fetchMastersOptions,
  });
  const techPackQuery = useQuery({
    queryKey: ["style-tech-pack", techPackStyle?.id],
    queryFn: () => fetchStyleTechPack(techPackStyle!.id),
    enabled: Boolean(techPackStyle?.id),
  });

  useEffect(() => {
    if (techPackQuery.data) {
      setTechPackDraft(techPackQuery.data);
      setSampleDraft(sampleDefaults);
      setSampleAssetIds([]);
    }
  }, [techPackQuery.data]);

  const refreshMasters = async () => {
    await queryClient.invalidateQueries({ queryKey: ["masters-summary"] });
    await queryClient.invalidateQueries({ queryKey: ["order-options"] });
    if (techPackStyle?.id) {
      await queryClient.invalidateQueries({ queryKey: ["style-tech-pack", techPackStyle.id] });
    }
  };

  const brandForm = useForm<BrandForm>({
    resolver: zodResolver(brandSchema),
    defaultValues: { code: "", name: "", countryCode: "" },
  });
  const supplierForm = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { code: "", name: "", defaultMaterial: "", leadTimeDays: 0 },
  });
  const vendorForm = useForm<VendorForm>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { code: "", name: "", process: "", capacityPerDay: 0, status: "ACTIVE" },
  });
  const styleForm = useForm<StyleForm>({
    resolver: zodResolver(styleSchema),
    defaultValues: {
      code: "",
      brandId: "",
      name: "",
      gauge: "",
      yarnDescription: "",
      sizesText: "",
      colorsText: "",
    },
  });
  const materialForm = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      sku: "",
      name: "",
      type: "YARN",
      uom: "Kg",
      stockQty: 0,
      allocatedQty: 0,
      reorderLevel: 0,
      supplierId: "",
    },
  });
  const bomForm = useForm<BomForm>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      styleId: "",
      materialId: "",
      quantityPerPiece: 0,
      uom: "",
    },
  });
  const lineForm = useForm<LineForm>({
    resolver: zodResolver(lineSchema),
    defaultValues: {
      code: "",
      name: "",
      process: "",
      gauge: "",
      machineCount: 0,
      isActive: true,
    },
  });

  const brandMutation = useMutation({
    mutationFn: async (values: BrandForm) => {
      if (editor?.kind === "brand" && editor.mode === "edit" && editor.item) {
        return updateBrand(editor.item.id, values);
      }
      return createBrand(values);
    },
    onSuccess: async () => {
      toast.success(`Brand ${editor?.mode === "edit" ? "updated" : "created"}`);
      setEditor(null);
      brandForm.reset({ code: "", name: "", countryCode: "" });
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save brand");
    },
  });

  const supplierMutation = useMutation({
    mutationFn: async (values: SupplierForm) => {
      if (editor?.kind === "supplier" && editor.mode === "edit" && editor.item) {
        return updateSupplier(editor.item.id, values);
      }
      return createSupplier(values);
    },
    onSuccess: async () => {
      toast.success(`Supplier ${editor?.mode === "edit" ? "updated" : "created"}`);
      setEditor(null);
      supplierForm.reset({ code: "", name: "", defaultMaterial: "", leadTimeDays: 0 });
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save supplier");
    },
  });

  const vendorMutation = useMutation({
    mutationFn: async (values: VendorForm) => {
      if (editor?.kind === "vendor" && editor.mode === "edit" && editor.item) {
        return updateVendor(editor.item.id, values);
      }
      return createVendor(values);
    },
    onSuccess: async () => {
      toast.success(`Vendor ${editor?.mode === "edit" ? "updated" : "created"}`);
      setEditor(null);
      vendorForm.reset({ code: "", name: "", process: "", capacityPerDay: 0, status: "ACTIVE" });
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save vendor");
    },
  });

  const styleMutation = useMutation({
    mutationFn: async (values: StyleForm) => {
      const payload = {
        code: values.code,
        brandId: values.brandId,
        name: values.name,
        gauge: values.gauge,
        yarnDescription: values.yarnDescription,
        sizes: splitCsv(values.sizesText),
        colors: styleColorsFromText(values.colorsText),
      };

      if (editor?.kind === "style" && editor.mode === "edit" && editor.item) {
        return updateStyle(editor.item.id, payload);
      }
      return createStyle(payload);
    },
    onSuccess: async () => {
      toast.success(`Style ${editor?.mode === "edit" ? "updated" : "created"}`);
      setEditor(null);
      styleForm.reset({
        code: "",
        brandId: "",
        name: "",
        gauge: "",
        yarnDescription: "",
        sizesText: "",
        colorsText: "",
      });
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save style");
    },
  });

  const materialMutation = useMutation({
    mutationFn: async (values: MaterialForm) => {
      const payload = { ...values, supplierId: values.supplierId || null };
      if (editor?.kind === "material" && editor.mode === "edit" && editor.item) {
        return updateMaterial(editor.item.id, payload);
      }
      return createMaterial(payload);
    },
    onSuccess: async () => {
      toast.success(`Material ${editor?.mode === "edit" ? "updated" : "created"}`);
      setEditor(null);
      materialForm.reset({ sku: "", name: "", type: "YARN", uom: "Kg", stockQty: 0, allocatedQty: 0, reorderLevel: 0, supplierId: "" });
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save material");
    },
  });

  const bomMutation = useMutation({
    mutationFn: async (values: BomForm) => {
      if (editor?.kind === "bom" && editor.mode === "edit" && editor.item) {
        return updateBomItem(editor.item.id, values);
      }
      return createBomItem(values);
    },
    onSuccess: async () => {
      toast.success(`BOM item ${editor?.mode === "edit" ? "updated" : "created"}`);
      setEditor(null);
      bomForm.reset({ styleId: "", materialId: "", quantityPerPiece: 0, uom: "" });
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save BOM item");
    },
  });

  const lineMutation = useMutation({
    mutationFn: async (values: LineForm) => {
      if (editor?.kind === "line" && editor.mode === "edit" && editor.item) {
        return updateLine(editor.item.id, values);
      }
      return createLine(values);
    },
    onSuccess: async () => {
      toast.success(`Line ${editor?.mode === "edit" ? "updated" : "created"}`);
      setEditor(null);
      lineForm.reset({ code: "", name: "", process: "", gauge: "", machineCount: 0, isActive: true });
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save production line");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteState) return;
      if (deleteState.kind === "brand") return deleteBrand(deleteState.item.id);
      if (deleteState.kind === "supplier") return deleteSupplier(deleteState.item.id);
      if (deleteState.kind === "vendor") return deleteVendor(deleteState.item.id);
      if (deleteState.kind === "material") return deleteMaterial(deleteState.item.id);
      if (deleteState.kind === "bom") return deleteBomItem(deleteState.item.id);
      if (deleteState.kind === "line") return deleteLine(deleteState.item.id);
      return deleteStyle(deleteState.item.id);
    },
    onSuccess: async () => {
      toast.success(`${deleteState?.kind ?? "Record"} deleted`);
      setDeleteState(null);
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to delete record");
    },
  });

  const techPackMutation = useMutation({
    mutationFn: async () => {
      if (!techPackStyle || !techPackDraft) {
        throw new Error("No style selected");
      }
      return updateStyleTechPack(techPackStyle.id, {
        measurements: techPackDraft.measurements,
        threadSpecs: techPackDraft.threadSpecs,
        colorways: techPackDraft.colorways,
      });
    },
    onSuccess: async (payload) => {
      setTechPackDraft(payload);
      toast.success("Tech pack updated");
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update tech pack");
    },
  });

  const sampleMutation = useMutation({
    mutationFn: async () => {
      if (!techPackStyle) {
        throw new Error("No style selected");
      }

      const existing = techPackDraft?.samples.find((item) => item.sampleType === sampleDraft.sampleType);
      const payload = {
        sampleType: sampleDraft.sampleType,
        status: sampleDraft.status,
        notes: sampleDraft.notes,
        assetIds: sampleAssetIds,
      };

      if (existing) {
        return updateStyleSample(techPackStyle.id, existing.id, payload);
      }
      return createStyleSample(techPackStyle.id, payload);
    },
    onSuccess: async () => {
      toast.success("Sample spec saved");
      setSampleDraft(sampleDefaults);
      setSampleAssetIds([]);
      if (techPackStyle?.id) {
        await queryClient.invalidateQueries({ queryKey: ["style-tech-pack", techPackStyle.id] });
      }
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save sample spec");
    },
  });

  const assetUploadMutation = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: FileAssetItem["kind"] }) => {
      if (!techPackStyle) {
        throw new Error("No style selected");
      }
      return uploadAsset({
        entityType: "STYLE",
        entityId: techPackStyle.id,
        kind,
        fileName: file.name,
        mimeType: file.type,
        dataBase64: await fileToBase64(file),
      });
    },
    onSuccess: async (response) => {
      toast.success(`${response.item.fileName} uploaded`);
      setSampleAssetIds((current) => Array.from(new Set([...current, response.item.id])));
      if (techPackStyle?.id) {
        await queryClient.invalidateQueries({ queryKey: ["style-tech-pack", techPackStyle.id] });
      }
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to upload asset");
    },
  });

  const deleteStyleAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      if (!techPackStyle) {
        throw new Error("No style selected");
      }
      return deleteStyleAsset(techPackStyle.id, assetId);
    },
    onSuccess: async () => {
      toast.success("Asset removed");
      if (techPackStyle?.id) {
        await queryClient.invalidateQueries({ queryKey: ["style-tech-pack", techPackStyle.id] });
      }
      await refreshMasters();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to remove asset");
    },
  });

  const totalRecords = useMemo(() => {
    if (!summaryQuery.data) return 0;
    return (
      summaryQuery.data.brands.length +
      summaryQuery.data.suppliers.length +
      summaryQuery.data.vendors.length +
      summaryQuery.data.styles.length +
      summaryQuery.data.materials.length +
      summaryQuery.data.bomItems.length +
      summaryQuery.data.lines.length
    );
  }, [summaryQuery.data]);

  const openTechPack = (style: MasterStyle) => {
    setTechPackDraft(null);
    setSampleDraft(sampleDefaults);
    setSampleAssetIds([]);
    setTechPackStyle(style);
  };

  const openEditor = (next: EditorState) => {
    setEditor(next);

    if (!next) return;

    if (next.kind === "brand") {
      brandForm.reset(
        next.item
          ? { code: next.item.code, name: next.item.name, countryCode: next.item.country }
          : { code: "", name: "", countryCode: "" },
      );
    }

    if (next.kind === "supplier") {
      supplierForm.reset(
        next.item
          ? {
              code: next.item.code,
              name: next.item.name,
              defaultMaterial: next.item.material,
              leadTimeDays: next.item.lead,
            }
          : { code: "", name: "", defaultMaterial: "", leadTimeDays: 0 },
      );
    }

    if (next.kind === "vendor") {
      vendorForm.reset(
        next.item
          ? {
              code: next.item.code,
              name: next.item.name,
              process: next.item.process,
              capacityPerDay: next.item.capacity,
              status: next.item.status === "Active" ? "ACTIVE" : "INACTIVE",
            }
          : { code: "", name: "", process: "", capacityPerDay: 0, status: "ACTIVE" },
      );
    }

    if (next.kind === "style") {
      styleForm.reset(
        next.item
          ? {
              code: next.item.code,
              brandId: next.item.brandId,
              name: next.item.name,
              gauge: next.item.gauge,
              yarnDescription: next.item.yarn,
              sizesText: next.item.sizes.join(", "),
              colorsText: next.item.colorItems?.map((color) => color.name).join(", ") ?? "",
            }
          : {
              code: "",
              brandId: "",
              name: "",
              gauge: "",
              yarnDescription: "",
              sizesText: "",
              colorsText: "",
        },
      );
    }

    if (next.kind === "material") {
      materialForm.reset(
        next.item
          ? {
              sku: next.item.sku,
              name: next.item.name,
              type: next.item.type.toUpperCase() as MaterialForm["type"],
              uom: next.item.uom,
              stockQty: next.item.stock,
              allocatedQty: next.item.allocated,
              reorderLevel: next.item.reorderLevel,
              supplierId: next.item.supplierId ?? "",
            }
          : { sku: "", name: "", type: "YARN", uom: "Kg", stockQty: 0, allocatedQty: 0, reorderLevel: 0, supplierId: "" },
      );
    }

    if (next.kind === "bom") {
      bomForm.reset(
        next.item
          ? {
              styleId: next.item.styleId,
              materialId: next.item.materialId,
              quantityPerPiece: next.item.qty,
              uom: next.item.uom,
            }
          : { styleId: "", materialId: "", quantityPerPiece: 0, uom: "" },
      );
    }

    if (next.kind === "line") {
      lineForm.reset(
        next.item
          ? {
              code: next.item.code,
              name: next.item.name,
              process: next.item.process,
              gauge: next.item.gauge,
              machineCount: next.item.machines,
              isActive: next.item.active,
            }
          : { code: "", name: "", process: "", gauge: "", machineCount: 0, isActive: true },
      );
    }
  };

  useEffect(() => {
    const state = location.state as { openMasterAction?: string; kind?: "brand" | "supplier" | "vendor" | "style" | "material" | "bom" | "line" } | null;
    if (state?.openMasterAction === "create" && state.kind) {
      openEditor({ kind: state.kind, mode: "create" } as EditorState);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const summary = summaryQuery.data;
  const isLoading = summaryQuery.isLoading || optionsQuery.isLoading;
  const isError = summaryQuery.isError || optionsQuery.isError;

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Master Data"
        description="Brands, vendors, suppliers, styles, BOM and factory setup"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" className="h-9" onClick={() => void refreshMasters()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditor({ kind: "brand", mode: "create" })}>
                  <Tag className="h-3.5 w-3.5 mr-2" /> New Brand
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditor({ kind: "vendor", mode: "create" })}>
                  <Boxes className="h-3.5 w-3.5 mr-2" /> New Vendor / Subcontractor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditor({ kind: "supplier", mode: "create" })}>
                  <Send className="h-3.5 w-3.5 mr-2" /> New Supplier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditor({ kind: "style", mode: "create" })}>
                  <ClipboardList className="h-3.5 w-3.5 mr-2" /> New Style
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditor({ kind: "material", mode: "create" })}>
                  <Boxes className="h-3.5 w-3.5 mr-2" /> New Yarn / Trim
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditor({ kind: "bom", mode: "create" })}>
                  <ClipboardList className="h-3.5 w-3.5 mr-2" /> New BOM
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditor({ kind: "line", mode: "create" })}>
                  <Boxes className="h-3.5 w-3.5 mr-2" /> New Line
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search across brands, vendors, suppliers, styles…"
            className="pl-9 h-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {totalRecords} total records
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Loading master data...
        </div>
      ) : isError || !summary ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center text-sm text-destructive">
          Unable to load master data.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section
            title="Brands / Customers"
            rows={summary.brands.length}
            newLabel="New Brand"
            onNew={() => openEditor({ kind: "brand", mode: "create" })}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Country</th>
                  <th className="px-4 py-2.5 text-right">Active POs</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {summary.brands.map((brand) => (
                  <tr key={brand.id} className="data-table-row">
                    <td className="px-4 py-2.5 font-mono-num text-xs">{brand.code}</td>
                    <td className="px-4 py-2.5 font-medium">{brand.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{brand.country}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{brand.activeOrders}</td>
                    <td className="px-2 py-2.5 text-right">
                      <RowActions
                        label={brand.name}
                        type="brand"
                        onEdit={() => openEditor({ kind: "brand", mode: "edit", item: brand })}
                        onDelete={() => setDeleteState({ kind: "brand", item: brand })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            title="Suppliers"
            rows={summary.suppliers.length}
            newLabel="New Supplier"
            onNew={() => openEditor({ kind: "supplier", mode: "create" })}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Material</th>
                  <th className="px-4 py-2.5 text-right">Lead (d)</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {summary.suppliers.map((supplier) => (
                  <tr key={supplier.id} className="data-table-row">
                    <td className="px-4 py-2.5 font-mono-num text-xs">{supplier.code}</td>
                    <td className="px-4 py-2.5 font-medium">{supplier.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{supplier.material}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{supplier.lead}</td>
                    <td className="px-2 py-2.5 text-right">
                      <RowActions
                        label={supplier.name}
                        type="supplier"
                        onEdit={() => openEditor({ kind: "supplier", mode: "edit", item: supplier })}
                        onDelete={() => setDeleteState({ kind: "supplier", item: supplier })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            title="Vendors / Subcontractors"
            rows={summary.vendors.length}
            newLabel="New Vendor"
            onNew={() => openEditor({ kind: "vendor", mode: "create" })}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Process</th>
                  <th className="px-4 py-2.5 text-right">Capacity</th>
                  <th className="px-4 py-2.5 text-right">Pending</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {summary.vendors.map((vendor) => (
                  <tr key={vendor.id} className="data-table-row">
                    <td className="px-4 py-2.5 font-mono-num text-xs">{vendor.code}</td>
                    <td className="px-4 py-2.5 font-medium">{vendor.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{vendor.process}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{vendor.capacity}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{vendor.pending}</td>
                    <td className="px-2 py-2.5 text-right">
                      <RowActions
                        label={vendor.name}
                        type="vendor"
                        onEdit={() => openEditor({ kind: "vendor", mode: "edit", item: vendor })}
                        onDelete={() => setDeleteState({ kind: "vendor", item: vendor })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            title="Styles / Products"
            rows={summary.styles.length}
            newLabel="New Style"
            onNew={() => openEditor({ kind: "style", mode: "create" })}
            className="lg:col-span-2"
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5">Style Code</th>
                  <th className="px-4 py-2.5">Brand</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Gauge</th>
                  <th className="px-4 py-2.5">Yarn</th>
                  <th className="px-4 py-2.5">Sizes</th>
                  <th className="px-4 py-2.5 text-right">Colors</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {summary.styles.map((style) => (
                  <tr key={style.id} className="data-table-row">
                    <td className="px-4 py-2.5 font-mono-num text-xs font-semibold text-primary">{style.code}</td>
                    <td className="px-4 py-2.5">{style.brand}</td>
                    <td className="px-4 py-2.5 font-medium">{style.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{style.gauge}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{style.yarn}</td>
                    <td className="px-4 py-2.5 text-xs">{style.sizes.join(", ")}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{style.colors}</td>
                    <td className="px-2 py-2.5 text-right">
                      <RowActions
                        label={style.code}
                        type="style"
                        onEdit={() => openEditor({ kind: "style", mode: "edit", item: style })}
                        onTechPack={() => openTechPack(style)}
                        onDelete={() => setDeleteState({ kind: "style", item: style })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            title="Materials / SKUs"
            rows={summary.materials.length}
            newLabel="New Material"
            onNew={() => openEditor({ kind: "material", mode: "create" })}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5 text-right">Stock</th>
                  <th className="px-4 py-2.5 text-right">Alloc.</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {summary.materials.map((material) => (
                  <tr key={material.id} className="data-table-row">
                    <td className="px-4 py-2.5 font-mono-num text-xs">{material.sku}</td>
                    <td className="px-4 py-2.5 font-medium">{material.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{material.type}</td>
                    <td className="px-4 py-2.5 text-xs">{material.supplier}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{material.stock}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{material.allocated}</td>
                    <td className="px-2 py-2.5 text-right">
                      <RowActions
                        label={material.sku}
                        type="material"
                        onEdit={() => openEditor({ kind: "material", mode: "edit", item: material })}
                        onDelete={() => setDeleteState({ kind: "material", item: material })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            title="Bill of Materials"
            rows={summary.bomItems.length}
            newLabel="New BOM Item"
            onNew={() => openEditor({ kind: "bom", mode: "create" })}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5">Style</th>
                  <th className="px-4 py-2.5">Material</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5 text-right">Per Pc</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {summary.bomItems.map((item) => (
                  <tr key={item.id} className="data-table-row">
                    <td className="px-4 py-2.5 font-mono-num text-xs">{item.styleCode}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{item.materialName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono-num">{item.materialSku}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{item.supplier ?? "Unassigned"}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">
                      {item.qty} <span className="text-[10px] text-muted-foreground">{item.uom}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <RowActions
                        label={`${item.styleCode} / ${item.materialSku}`}
                        type="bom"
                        onEdit={() => openEditor({ kind: "bom", mode: "edit", item })}
                        onDelete={() => setDeleteState({ kind: "bom", item })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section
            title="Production Lines"
            rows={summary.lines.length}
            newLabel="New Line"
            onNew={() => openEditor({ kind: "line", mode: "create" })}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Process</th>
                  <th className="px-4 py-2.5">Gauge</th>
                  <th className="px-4 py-2.5 text-right">Machines</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((line) => (
                  <tr key={line.id} className="data-table-row">
                    <td className="px-4 py-2.5 font-mono-num text-xs">{line.code}</td>
                    <td className="px-4 py-2.5 font-medium">{line.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{line.process}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{line.gauge}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{line.machines}</td>
                    <td className="px-4 py-2.5 text-xs">{line.active ? "Active" : "Inactive"}</td>
                    <td className="px-2 py-2.5 text-right">
                      <RowActions
                        label={line.name}
                        type="line"
                        onEdit={() => openEditor({ kind: "line", mode: "edit", item: line })}
                        onDelete={() => setDeleteState({ kind: "line", item: line })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      )}

      <EditDialog
        editor={editor}
        options={{
          brands: optionsQuery.data?.brands ?? [],
          suppliers: optionsQuery.data?.suppliers ?? [],
          styles: optionsQuery.data?.styles ?? [],
          materials: optionsQuery.data?.materials ?? [],
        }}
        brandForm={brandForm}
        supplierForm={supplierForm}
        vendorForm={vendorForm}
        styleForm={styleForm}
        materialForm={materialForm}
        bomForm={bomForm}
        lineForm={lineForm}
        brandMutation={brandMutation}
        supplierMutation={supplierMutation}
        vendorMutation={vendorMutation}
        styleMutation={styleMutation}
        materialMutation={materialMutation}
        bomMutation={bomMutation}
        lineMutation={lineMutation}
        onClose={() => setEditor(null)}
      />

      <TechPackDialog
        style={techPackStyle}
        draft={techPackDraft}
        options={{
          suppliers: optionsQuery.data?.suppliers ?? [],
          materials: optionsQuery.data?.materials ?? [],
        }}
        sampleDraft={sampleDraft}
        sampleAssetIds={sampleAssetIds}
        loading={techPackQuery.isLoading}
        saving={techPackMutation.isPending}
        sampleSaving={sampleMutation.isPending}
        assetUploading={assetUploadMutation.isPending}
        assetDeleting={deleteStyleAssetMutation.isPending}
        onClose={() => setTechPackStyle(null)}
        onDraftChange={setTechPackDraft}
        onSampleDraftChange={setSampleDraft}
        onSampleAssetIdsChange={setSampleAssetIds}
        onSave={() => techPackMutation.mutate()}
        onSaveSample={() => sampleMutation.mutate()}
        onUpload={(file, kind) => assetUploadMutation.mutate({ file, kind })}
        onDeleteAsset={(assetId) => deleteStyleAssetMutation.mutate(assetId)}
      />

      <Dialog open={Boolean(deleteState)} onOpenChange={(open) => !open && setDeleteState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteState?.kind}</DialogTitle>
            <DialogDescription>
              This will permanently remove <span className="font-medium">{getDeleteLabel(deleteState)}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteState(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditDialog({
  editor,
  options,
  brandForm,
  supplierForm,
  vendorForm,
  styleForm,
  materialForm,
  bomForm,
  lineForm,
  brandMutation,
  supplierMutation,
  vendorMutation,
  styleMutation,
  materialMutation,
  bomMutation,
  lineMutation,
  onClose,
}: {
  editor: EditorState;
  options: {
    brands: Array<{ id: string; name: string; code: string }>;
    suppliers: Array<{ id: string; name: string; code: string }>;
    styles: Array<{ id: string; code: string; name: string; brandId: string }>;
    materials: Array<{ id: string; sku: string; name: string; supplierId?: string | null }>;
  };
  brandForm: ReturnType<typeof useForm<BrandForm>>;
  supplierForm: ReturnType<typeof useForm<SupplierForm>>;
  vendorForm: ReturnType<typeof useForm<VendorForm>>;
  styleForm: ReturnType<typeof useForm<StyleForm>>;
  materialForm: ReturnType<typeof useForm<MaterialForm>>;
  bomForm: ReturnType<typeof useForm<BomForm>>;
  lineForm: ReturnType<typeof useForm<LineForm>>;
  brandMutation: { mutate: (values: BrandForm) => void; isPending: boolean };
  supplierMutation: { mutate: (values: SupplierForm) => void; isPending: boolean };
  vendorMutation: { mutate: (values: VendorForm) => void; isPending: boolean };
  styleMutation: { mutate: (values: StyleForm) => void; isPending: boolean };
  materialMutation: { mutate: (values: MaterialForm) => void; isPending: boolean };
  bomMutation: { mutate: (values: BomForm) => void; isPending: boolean };
  lineMutation: { mutate: (values: LineForm) => void; isPending: boolean };
  onClose: () => void;
}) {
  if (!editor) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editor.mode === "edit" ? "Edit" : "Create"} {editor.kind}</DialogTitle>
          <DialogDescription>
            Update the current master data record without changing the existing page layout.
          </DialogDescription>
        </DialogHeader>

        {editor.kind === "brand" && (
          <Form {...brandForm}>
            <form onSubmit={brandForm.handleSubmit((values) => brandMutation.mutate(values))} className="space-y-4">
              <FormField control={brandForm.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={brandForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={brandForm.control} name="countryCode" render={({ field }) => (
                <FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={brandMutation.isPending}>{brandMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {editor.kind === "supplier" && (
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit((values) => supplierMutation.mutate(values))} className="space-y-4">
              <FormField control={supplierForm.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={supplierForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={supplierForm.control} name="defaultMaterial" render={({ field }) => (
                <FormItem><FormLabel>Default Material</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={supplierForm.control} name="leadTimeDays" render={({ field }) => (
                <FormItem><FormLabel>Lead Time (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={supplierMutation.isPending}>{supplierMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {editor.kind === "vendor" && (
          <Form {...vendorForm}>
            <form onSubmit={vendorForm.handleSubmit((values) => vendorMutation.mutate(values))} className="space-y-4">
              <FormField control={vendorForm.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={vendorForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={vendorForm.control} name="process" render={({ field }) => (
                <FormItem><FormLabel>Process</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={vendorForm.control} name="capacityPerDay" render={({ field }) => (
                <FormItem><FormLabel>Capacity / day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={vendorForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={vendorMutation.isPending}>{vendorMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {editor.kind === "style" && (
          <Form {...styleForm}>
            <form onSubmit={styleForm.handleSubmit((values) => styleMutation.mutate(values))} className="space-y-4">
              <FormField control={styleForm.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>Style Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={styleForm.control} name="brandId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {options.brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={styleForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={styleForm.control} name="gauge" render={({ field }) => (
                  <FormItem><FormLabel>Gauge</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={styleForm.control} name="yarnDescription" render={({ field }) => (
                  <FormItem><FormLabel>Yarn</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={styleForm.control} name="sizesText" render={({ field }) => (
                <FormItem><FormLabel>Sizes</FormLabel><FormControl><Input placeholder="S, M, L, XL" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={styleForm.control} name="colorsText" render={({ field }) => (
                <FormItem><FormLabel>Colours</FormLabel><FormControl><Input placeholder="Ecru, Navy, Burgundy" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={styleMutation.isPending}>{styleMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {editor.kind === "material" && (
          <Form {...materialForm}>
            <form onSubmit={materialForm.handleSubmit((values) => materialMutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={materialForm.control} name="sku" render={({ field }) => (
                  <FormItem><FormLabel>SKU</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={materialForm.control} name="uom" render={({ field }) => (
                  <FormItem><FormLabel>UOM</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={materialForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={materialForm.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="YARN">Yarn</SelectItem>
                        <SelectItem value="TRIM">Trim</SelectItem>
                        <SelectItem value="LABEL">Label</SelectItem>
                        <SelectItem value="PACKING">Packing</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={materialForm.control} name="supplierId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {options.suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={materialForm.control} name="stockQty" render={({ field }) => (
                  <FormItem><FormLabel>Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={materialForm.control} name="allocatedQty" render={({ field }) => (
                  <FormItem><FormLabel>Allocated</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={materialForm.control} name="reorderLevel" render={({ field }) => (
                  <FormItem><FormLabel>Reorder</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={materialMutation.isPending}>{materialMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {editor.kind === "bom" && (
          <Form {...bomForm}>
            <form onSubmit={bomForm.handleSubmit((values) => bomMutation.mutate(values))} className="space-y-4">
              <FormField control={bomForm.control} name="styleId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Style</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {options.styles.map((style) => (
                        <SelectItem key={style.id} value={style.id}>{style.code} — {style.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bomForm.control} name="materialId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Material</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {options.materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>{material.sku} — {material.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={bomForm.control} name="quantityPerPiece" render={({ field }) => (
                  <FormItem><FormLabel>Per Piece Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={bomForm.control} name="uom" render={({ field }) => (
                  <FormItem><FormLabel>UOM</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={bomMutation.isPending}>{bomMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {editor.kind === "line" && (
          <Form {...lineForm}>
            <form onSubmit={lineForm.handleSubmit((values) => lineMutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={lineForm.control} name="code" render={({ field }) => (
                  <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={lineForm.control} name="gauge" render={({ field }) => (
                  <FormItem><FormLabel>Gauge</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={lineForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={lineForm.control} name="process" render={({ field }) => (
                  <FormItem><FormLabel>Process</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={lineForm.control} name="machineCount" render={({ field }) => (
                  <FormItem><FormLabel>Machines</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={lineForm.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value ? "ACTIVE" : "INACTIVE"} onValueChange={(value) => field.onChange(value === "ACTIVE")}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={lineMutation.isPending}>{lineMutation.isPending ? "Saving..." : "Save"}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TechPackDialog({
  style,
  draft,
  options,
  sampleDraft,
  sampleAssetIds,
  loading,
  saving,
  sampleSaving,
  assetUploading,
  assetDeleting,
  onClose,
  onDraftChange,
  onSampleDraftChange,
  onSampleAssetIdsChange,
  onSave,
  onSaveSample,
  onUpload,
  onDeleteAsset,
}: {
  style: MasterStyle | null;
  draft: StyleTechPackPayload | null;
  options: {
    suppliers: Array<{ id: string; name: string; code: string }>;
    materials: Array<{ id: string; sku: string; name: string; supplierId?: string | null }>;
  };
  sampleDraft: { sampleType: "PROTO" | "FIT" | "SIZE_SET" | "PP" | "SHIPMENT"; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISED"; notes: string };
  sampleAssetIds: string[];
  loading: boolean;
  saving: boolean;
  sampleSaving: boolean;
  assetUploading: boolean;
  assetDeleting: boolean;
  onClose: () => void;
  onDraftChange: React.Dispatch<React.SetStateAction<StyleTechPackPayload | null>>;
  onSampleDraftChange: React.Dispatch<React.SetStateAction<{ sampleType: "PROTO" | "FIT" | "SIZE_SET" | "PP" | "SHIPMENT"; status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISED"; notes: string }>>;
  onSampleAssetIdsChange: React.Dispatch<React.SetStateAction<string[]>>;
  onSave: () => void;
  onSaveSample: () => void;
  onUpload: (file: File, kind: FileAssetItem["kind"]) => void;
  onDeleteAsset: (assetId: string) => void;
}) {
  return (
    <Dialog open={Boolean(style)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{style?.code ? `${style.code} Tech Pack` : "Tech Pack"}</DialogTitle>
          <DialogDescription>
            Manage design assets, sample specs, thread details, colour metadata, and measurements without leaving Masters.
          </DialogDescription>
        </DialogHeader>

        {loading || !draft ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading tech pack...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Assets</h3>
                    <p className="text-xs text-muted-foreground">Sample images, references, and attached PDFs.</p>
                  </div>
                  <span className="text-xs font-mono-num text-muted-foreground">{draft.assets.length} files</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {draft.assets.map((asset) => (
                    <div key={asset.id} className="rounded-md border border-border p-3 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{asset.fileName}</p>
                          <p className="text-muted-foreground">{asset.kind.replaceAll("_", " ")}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={assetDeleting}
                          onClick={() => onDeleteAsset(asset.id)}
                        >
                          Remove
                        </Button>
                      </div>
                      {asset.mimeType.startsWith("image/") && (
                        <img
                          src={asset.url}
                          alt={asset.fileName}
                          className="mt-3 h-28 w-full rounded-md border border-border object-cover"
                        />
                      )}
                      <a href={asset.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-primary underline-offset-4 hover:underline">
                        Open asset
                      </a>
                    </div>
                  ))}
                  {!draft.assets.length && (
                    <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                      Upload the first sample image, reference, or tech-pack PDF for this style.
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["SAMPLE_IMAGE", "REFERENCE_IMAGE", "TECH_PACK", "ATTACHMENT"] as const).map((kind) => (
                    <label key={kind} className="inline-flex">
                      <Input
                        type="file"
                        className="hidden"
                        accept={kind === "TECH_PACK" ? "application/pdf" : "image/jpeg,image/png,image/webp,application/pdf"}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUpload(file, kind);
                          event.currentTarget.value = "";
                        }}
                      />
                      <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs">
                        {assetUploading ? "Uploading..." : `Upload ${kind.toLowerCase().replaceAll("_", " ")}`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Sample Spec</h3>
                  <p className="text-xs text-muted-foreground">Capture sample stage, approval status, and linked visuals.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Sample Type</label>
                    <Select value={sampleDraft.sampleType} onValueChange={(value) => onSampleDraftChange((current) => ({ ...current, sampleType: value as typeof current.sampleType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROTO">Proto</SelectItem>
                        <SelectItem value="FIT">Fit</SelectItem>
                        <SelectItem value="SIZE_SET">Size Set</SelectItem>
                        <SelectItem value="PP">PP</SelectItem>
                        <SelectItem value="SHIPMENT">Shipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Status</label>
                    <Select value={sampleDraft.status} onValueChange={(value) => onSampleDraftChange((current) => ({ ...current, status: value as typeof current.status }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="SUBMITTED">Submitted</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                        <SelectItem value="REVISED">Revised</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Notes</label>
                  <Textarea
                    value={sampleDraft.notes}
                    onChange={(event) => onSampleDraftChange((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                    placeholder="Fit comments, buyer feedback, wash notes..."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium">Link Assets</label>
                  <div className="space-y-2">
                    {draft.assets.map((asset) => {
                      const selected = sampleAssetIds.includes(asset.id);
                      return (
                        <label key={asset.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              onSampleAssetIdsChange((current) => event.target.checked
                                ? Array.from(new Set([...current, asset.id]))
                                : current.filter((item) => item !== asset.id));
                            }}
                          />
                          <span className="truncate">{asset.fileName}</span>
                        </label>
                      );
                    })}
                    {!draft.assets.length && <p className="text-xs text-muted-foreground">Upload assets first to link them to the sample.</p>}
                  </div>
                </div>
                <Button type="button" size="sm" onClick={onSaveSample} disabled={sampleSaving}>
                  {sampleSaving ? "Saving sample..." : "Save Sample Spec"}
                </Button>
                {!!draft.samples.length && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-medium">Existing samples</p>
                    {draft.samples.map((sample) => (
                      <div key={sample.id} className="rounded-md border border-border p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{sample.sampleType.replaceAll("_", " ")}</span>
                          <span className="text-muted-foreground">{sample.status}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{sample.notes || "No notes recorded."}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Measurements</h3>
                  <p className="text-xs text-muted-foreground">Size chart and tolerance data used downstream in sampling and production.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onDraftChange((current) => current ? { ...current, measurements: [...current.measurements, emptyMeasurement()] } : current)}>
                  Add Measurement
                </Button>
              </div>
              <div className="space-y-2">
                {draft.measurements.map((measurement, index) => (
                  <div key={`${measurement.id ?? "new"}-${index}`} className="grid gap-2 md:grid-cols-[0.8fr_1.3fr_0.7fr_0.6fr_0.6fr_0.5fr_auto]">
                    <Input value={measurement.sizeLabel} placeholder="Size" onChange={(event) => onDraftChange((current) => current ? { ...current, measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, sizeLabel: event.target.value } : item) } : current)} />
                    <Input value={measurement.measurementPoint} placeholder="Measurement point" onChange={(event) => onDraftChange((current) => current ? { ...current, measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, measurementPoint: event.target.value } : item) } : current)} />
                    <Input type="number" step="0.01" value={measurement.targetValue} onChange={(event) => onDraftChange((current) => current ? { ...current, measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, targetValue: Number(event.target.value) } : item) } : current)} />
                    <Input type="number" step="0.01" value={measurement.tolerancePlus} onChange={(event) => onDraftChange((current) => current ? { ...current, measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, tolerancePlus: Number(event.target.value) } : item) } : current)} />
                    <Input type="number" step="0.01" value={measurement.toleranceMinus} onChange={(event) => onDraftChange((current) => current ? { ...current, measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, toleranceMinus: Number(event.target.value) } : item) } : current)} />
                    <Input value={measurement.unit} onChange={(event) => onDraftChange((current) => current ? { ...current, measurements: current.measurements.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item) } : current)} />
                    <Button type="button" size="sm" variant="ghost" onClick={() => onDraftChange((current) => current ? { ...current, measurements: current.measurements.filter((_, itemIndex) => itemIndex !== index) } : current)}>Remove</Button>
                  </div>
                ))}
                {!draft.measurements.length && <p className="text-xs text-muted-foreground">No measurements added yet.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Thread Specs</h3>
                  <p className="text-xs text-muted-foreground">Yarn, count, supplier linkage, and process notes.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onDraftChange((current) => current ? { ...current, threadSpecs: [...current.threadSpecs, emptyThreadSpec(current.threadSpecs.length + 1)] } : current)}>
                  Add Thread Spec
                </Button>
              </div>
              <div className="space-y-2">
                {draft.threadSpecs.map((spec, index) => (
                  <div key={`${spec.id ?? "new"}-${index}`} className="grid gap-2 md:grid-cols-2">
                    <Input value={spec.materialName} placeholder="Material / yarn" onChange={(event) => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.map((item, itemIndex) => itemIndex === index ? { ...item, materialName: event.target.value } : item) } : current)} />
                    <Input value={spec.countSpec} placeholder="Count / spec" onChange={(event) => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.map((item, itemIndex) => itemIndex === index ? { ...item, countSpec: event.target.value } : item) } : current)} />
                    <Input value={spec.colorRef} placeholder="Colour ref" onChange={(event) => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.map((item, itemIndex) => itemIndex === index ? { ...item, colorRef: event.target.value } : item) } : current)} />
                    <Select value={spec.supplierId ?? "__none__"} onValueChange={(value) => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.map((item, itemIndex) => itemIndex === index ? { ...item, supplierId: value === "__none__" ? null : value } : item) } : current)}>
                      <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No supplier</SelectItem>
                        {options.suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={spec.materialId ?? "__none__"} onValueChange={(value) => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.map((item, itemIndex) => itemIndex === index ? { ...item, materialId: value === "__none__" ? null : value } : item) } : current)}>
                      <SelectTrigger><SelectValue placeholder="Material link" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No material link</SelectItem>
                        {options.materials.map((material) => <SelectItem key={material.id} value={material.id}>{material.sku} — {material.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={String(spec.sortOrder)} type="number" placeholder="Sort order" onChange={(event) => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.map((item, itemIndex) => itemIndex === index ? { ...item, sortOrder: Number(event.target.value) } : item) } : current)} />
                    <Textarea value={spec.processNotes} rows={2} placeholder="Process notes" onChange={(event) => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.map((item, itemIndex) => itemIndex === index ? { ...item, processNotes: event.target.value } : item) } : current)} />
                    <div className="md:col-span-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => onDraftChange((current) => current ? { ...current, threadSpecs: current.threadSpecs.filter((_, itemIndex) => itemIndex !== index) } : current)}>
                        Remove thread spec
                      </Button>
                    </div>
                  </div>
                ))}
                {!draft.threadSpecs.length && <p className="text-xs text-muted-foreground">No thread specs added yet.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Colourways</h3>
                  <p className="text-xs text-muted-foreground">Pantone, thread references, and notes for each colourway.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => onDraftChange((current) => current ? { ...current, colorways: [...current.colorways, emptyColorway()] } : current)}>
                  Add Colourway
                </Button>
              </div>
              <div className="space-y-2">
                {draft.colorways.map((color, index) => (
                  <div key={`${color.id ?? "new"}-${index}`} className="grid gap-2 md:grid-cols-[0.9fr_0.8fr_0.8fr_0.8fr_1.2fr_auto]">
                    <Input value={color.name} placeholder="Colour name" onChange={(event) => onDraftChange((current) => current ? { ...current, colorways: current.colorways.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) } : current)} />
                    <Input value={color.hexCode ?? ""} placeholder="#RRGGBB" onChange={(event) => onDraftChange((current) => current ? { ...current, colorways: current.colorways.map((item, itemIndex) => itemIndex === index ? { ...item, hexCode: event.target.value } : item) } : current)} />
                    <Input value={color.pantoneCode ?? ""} placeholder="Pantone" onChange={(event) => onDraftChange((current) => current ? { ...current, colorways: current.colorways.map((item, itemIndex) => itemIndex === index ? { ...item, pantoneCode: event.target.value } : item) } : current)} />
                    <Input value={color.threadCode ?? ""} placeholder="Thread code" onChange={(event) => onDraftChange((current) => current ? { ...current, colorways: current.colorways.map((item, itemIndex) => itemIndex === index ? { ...item, threadCode: event.target.value } : item) } : current)} />
                    <Input value={color.notes ?? ""} placeholder="Notes" onChange={(event) => onDraftChange((current) => current ? { ...current, colorways: current.colorways.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item) } : current)} />
                    <Button type="button" size="sm" variant="ghost" onClick={() => onDraftChange((current) => current ? { ...current, colorways: current.colorways.filter((_, itemIndex) => itemIndex !== index) } : current)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button type="button" onClick={onSave} disabled={saving}>
                {saving ? "Saving tech pack..." : "Save Tech Pack"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  rows,
  children,
  className = "",
  onNew,
  newLabel,
}: {
  title: string;
  rows: number;
  children: React.ReactNode;
  className?: string;
  onNew?: () => void;
  newLabel?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      <div className="p-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground font-mono-num">{rows} records</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onNew && newLabel && (
            <Button size="sm" className="h-8" onClick={onNew}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> {newLabel}
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function RowActions({
  label,
  type,
  onEdit,
  onTechPack,
  onDelete,
}: {
  label: string;
  type: "brand" | "supplier" | "vendor" | "style" | "material" | "bom" | "line";
  onEdit: () => void;
  onTechPack?: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
        </DropdownMenuItem>
        {type === "style" && (
          <DropdownMenuItem onClick={() => onTechPack?.()}>
            <FileText className="h-3.5 w-3.5 mr-2" /> Tech pack
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
