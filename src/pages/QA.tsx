import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCapa, createQaInspection, fetchQa, updateCapa, updateQaInspection } from "@/lib/services";
import { ShieldCheck, AlertOctagon, RotateCcw, CheckCircle2, Plus, Pencil } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const inspectionSchema = z.object({
  inspectedAt: z.string().min(1, "Select a date"),
  orderId: z.string().optional(),
  vendorId: z.string().optional(),
  lineId: z.string().optional(),
  stage: z.string().min(1, "Select a stage"),
  checkedQty: z.coerce.number().int().positive(),
  approvedQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
  reworkQty: z.coerce.number().int().min(0),
  defectTypeId: z.string().optional(),
  defectCount: z.coerce.number().int().min(0),
});

const capaSchema = z.object({
  inspectionId: z.string().optional(),
  vendorId: z.string().optional(),
  orderId: z.string().optional(),
  lineId: z.string().optional(),
  title: z.string().min(3, "Enter a title"),
  rootCause: z.string().min(3, "Enter a root cause"),
  ownerName: z.string().min(2, "Enter an owner"),
  dueDate: z.string().min(1, "Select a due date"),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).default("OPEN"),
});

type InspectionInput = z.infer<typeof inspectionSchema>;
type CapaInput = z.infer<typeof capaSchema>;

const stageOptions = [
  "YARN_INWARD",
  "KNITTING",
  "LINKING",
  "WASHING",
  "DRYING",
  "FINISHING",
  "IRONING",
  "QUALITY_CHECK",
  "PACKING",
  "DISPATCH",
];

export default function QA() {
  const [open, setOpen] = useState(false);
  const [editingInspectionId, setEditingInspectionId] = useState<string | null>(null);
  const [capaOpen, setCapaOpen] = useState(false);
  const [editingCapaId, setEditingCapaId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const qaQuery = useQuery({
    queryKey: ["qa"],
    queryFn: fetchQa,
  });

  const form = useForm<InspectionInput>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      inspectedAt: "",
      orderId: "",
      vendorId: "",
      lineId: "",
      stage: "QUALITY_CHECK",
      checkedQty: undefined,
      approvedQty: 0,
      rejectedQty: 0,
      reworkQty: 0,
      defectTypeId: "",
      defectCount: 0,
    },
  });
  const capaForm = useForm<CapaInput>({
    resolver: zodResolver(capaSchema),
    defaultValues: {
      inspectionId: "",
      vendorId: "",
      orderId: "",
      lineId: "",
      title: "",
      rootCause: "",
      ownerName: "",
      dueDate: "",
      status: "OPEN",
    },
  });

  const resetForm = () => {
    setOpen(false);
    setEditingInspectionId(null);
    form.reset({
      inspectedAt: "",
      orderId: "",
      vendorId: "",
      lineId: "",
      stage: "QUALITY_CHECK",
      checkedQty: undefined,
      approvedQty: 0,
      rejectedQty: 0,
      reworkQty: 0,
      defectTypeId: "",
      defectCount: 0,
    });
  };

  const inspectionMutation = useMutation({
    mutationFn: (values: InspectionInput) => {
      const payload = {
        inspectedAt: values.inspectedAt,
        orderId: values.orderId || null,
        vendorId: values.vendorId || null,
        lineId: values.lineId || null,
        stage: values.stage,
        checkedQty: values.checkedQty,
        approvedQty: values.approvedQty,
        rejectedQty: values.rejectedQty,
        reworkQty: values.reworkQty,
        defects: values.defectTypeId && values.defectCount > 0 ? [{ defectTypeId: values.defectTypeId, count: values.defectCount }] : [],
      };
      if (editingInspectionId) {
        return updateQaInspection(editingInspectionId, payload);
      }
      return createQaInspection(payload);
    },
    onSuccess: async () => {
      toast.success(editingInspectionId ? "Inspection updated" : "Inspection created", {
        description: editingInspectionId ? "Inspection changes have been saved." : "QA metrics have been updated.",
      });
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["qa"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor-detail"] });
    },
    onError: (error) => {
      toast.error(editingInspectionId ? "Unable to update inspection" : "Unable to create inspection", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
  const capaMutation = useMutation({
    mutationFn: (values: CapaInput) => {
      const payload = {
        inspectionId: values.inspectionId || null,
        vendorId: values.vendorId || null,
        orderId: values.orderId || null,
        lineId: values.lineId || null,
        title: values.title,
        rootCause: values.rootCause,
        ownerName: values.ownerName,
        dueDate: values.dueDate,
        status: values.status,
      };
      if (editingCapaId) {
        return updateCapa(editingCapaId, payload);
      }
      return createCapa(payload);
    },
    onSuccess: async () => {
      toast.success(editingCapaId ? "CAPA updated" : "CAPA created");
      setCapaOpen(false);
      setEditingCapaId(null);
      capaForm.reset({
        inspectionId: "",
        vendorId: "",
        orderId: "",
        lineId: "",
        title: "",
        rootCause: "",
        ownerName: "",
        dueDate: "",
        status: "OPEN",
      });
      await queryClient.invalidateQueries({ queryKey: ["qa"] });
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor-detail"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => {
      toast.error("Unable to save CAPA", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (qaQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading QA...</div>;
  }

  if (qaQuery.isError || !qaQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load QA.</div>;
  }

  const { summary, defects, vendors, inspections, orderOptions, lineOptions, defectTypes, capaItems } = qaQuery.data;

  const openCreate = () => {
    setEditingInspectionId(null);
    form.reset({
      inspectedAt: "",
      orderId: "",
      vendorId: "",
      lineId: "",
      stage: "QUALITY_CHECK",
      checkedQty: undefined,
      approvedQty: 0,
      rejectedQty: 0,
      reworkQty: 0,
      defectTypeId: "",
      defectCount: 0,
    });
    setOpen(true);
  };

  const openEdit = (inspection: typeof inspections[number]) => {
    setEditingInspectionId(inspection.id);
    form.reset({
      inspectedAt: inspection.inspectedAt,
      orderId: inspection.orderId ?? "",
      vendorId: inspection.vendorId ?? "",
      lineId: inspection.lineId ?? "",
      stage: inspection.stage,
      checkedQty: inspection.checkedQty,
      approvedQty: inspection.approvedQty,
      rejectedQty: inspection.rejectedQty,
      reworkQty: inspection.reworkQty,
      defectTypeId: inspection.defects[0]?.defectTypeId ?? "",
      defectCount: inspection.defects[0]?.count ?? 0,
    });
    setOpen(true);
  };

  const openCapaCreate = () => {
    setEditingCapaId(null);
    capaForm.reset({
      inspectionId: inspections[0]?.id ?? "",
      vendorId: vendors[0]?.id ?? "",
      orderId: orderOptions[0]?.id ?? "",
      lineId: lineOptions[0]?.id ?? "",
      title: "",
      rootCause: "",
      ownerName: "",
      dueDate: new Date().toISOString().slice(0, 10),
      status: "OPEN",
    });
    setCapaOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Quality"
        title="Quality Assurance"
        description="Inline & endline checks, rejection trends, root cause analysis"
        actions={
          <>
            <Button size="sm" variant="outline" className="h-9" onClick={openCapaCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add CAPA
            </Button>
            <Button size="sm" className="h-9" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Inspection
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Pieces Checked" value={summary.checked.toLocaleString("en-IN")} icon={ShieldCheck} tone="info" />
        <KpiCard label="Approved" value={summary.approved.toLocaleString("en-IN")} icon={CheckCircle2} tone="success" />
        <KpiCard label="Rejected" value={summary.rejected.toLocaleString("en-IN")} icon={AlertOctagon} tone="destructive" />
        <KpiCard label="Rework" value={summary.rework.toLocaleString("en-IN")} icon={RotateCcw} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Defects by Type</h3>
          <p className="text-xs text-muted-foreground mb-4">Pareto — last 30 days</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={defects} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={11} width={130} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="hsl(var(--chart-6))" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold">Vendor-wise Quality Trend</h3>
            <p className="text-xs text-muted-foreground">Pass rate by subcontractor</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Vendor</th>
                <th className="px-4 py-3 font-semibold">Process</th>
                <th className="px-4 py-3 font-semibold w-48">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="data-table-row">
                  <td className="px-4 py-3 font-medium">{vendor.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{vendor.process}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${vendor.quality >= 95 ? "bg-success" : "bg-warning"}`} style={{ width: `${vendor.quality}%` }} />
                      </div>
                      <span className="text-[11px] font-mono-num font-semibold w-9 text-right">{vendor.quality}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden mt-4">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Recent Inspections</h3>
          <p className="text-xs text-muted-foreground">Latest recorded QA checks</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Vendor / Line</th>
              <th className="px-4 py-3 font-semibold text-right">Checked</th>
              <th className="px-4 py-3 font-semibold text-right">Rejected</th>
              <th className="px-4 py-3 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {inspections.slice(0, 8).map((inspection) => (
              <tr key={inspection.id} className="data-table-row">
                <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">{inspection.inspectedAt}</td>
                <td className="px-4 py-3 text-xs">{inspection.stage.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 font-mono-num text-xs">{inspection.orderPo ?? "Unlinked"}</td>
                <td className="px-4 py-3 text-xs">{inspection.vendorName ?? inspection.lineName ?? "Internal"}</td>
                <td className="px-4 py-3 text-right font-mono-num">{inspection.checkedQty}</td>
                <td className="px-4 py-3 text-right font-mono-num text-destructive">{inspection.rejectedQty}</td>
                <td className="px-2 py-3 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(inspection)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {!inspections.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No inspections recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden mt-4">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Corrective Actions (CAPA)</h3>
          <p className="text-xs text-muted-foreground">Open and closed quality actions linked to inspections and vendors</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Vendor / Order</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {capaItems.length ? capaItems.map((item) => (
              <tr key={item.id} className="data-table-row">
                <td className="px-4 py-3">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.rootCause}</div>
                </td>
                <td className="px-4 py-3 text-xs">{item.ownerName}</td>
                <td className="px-4 py-3 text-xs">{item.vendorName ?? "Internal"}{item.orderPo ? ` • ${item.orderPo}` : ""}</td>
                <td className="px-4 py-3 text-xs font-mono-num">{item.dueDate}</td>
                <td className="px-4 py-3 text-xs">{item.status.replaceAll("_", " ")}</td>
                <td className="px-2 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingCapaId(item.id);
                      capaForm.reset({
                        inspectionId: item.inspectionId ?? "",
                        vendorId: item.vendorId ?? "",
                        orderId: item.orderId ?? "",
                        lineId: item.lineId ?? "",
                        title: item.title,
                        rootCause: item.rootCause,
                        ownerName: item.ownerName,
                        dueDate: item.dueDate,
                        status: item.status,
                      });
                      setCapaOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No CAPA actions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : resetForm())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInspectionId ? "Edit Inspection" : "Add Inspection"}</DialogTitle>
            <DialogDescription>{editingInspectionId ? "Update a QA inspection and recalculate metrics." : "Create a QA inspection and update quality metrics."}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => inspectionMutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="inspectedAt" render={({ field }) => (
                  <Field label="Inspection Date"><FormControl><Input type="date" {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
                <FormField control={form.control} name="stage" render={({ field }) => (
                  <Field label="Stage">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{stageOptions.map((stage) => <SelectItem key={stage} value={stage}>{stage.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="orderId" render={({ field }) => (
                  <Field label="Order">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>{orderOptions.map((order) => <SelectItem key={order.id} value={order.id}>{order.poNumber}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
                <FormField control={form.control} name="vendorId" render={({ field }) => (
                  <Field label="Vendor">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
                <FormField control={form.control} name="lineId" render={({ field }) => (
                  <Field label="Line">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>{lineOptions.map((line) => <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <FormField control={form.control} name="checkedQty" render={({ field }) => (
                  <Field label="Checked"><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
                <FormField control={form.control} name="approvedQty" render={({ field }) => (
                  <Field label="Approved"><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
                <FormField control={form.control} name="rejectedQty" render={({ field }) => (
                  <Field label="Rejected"><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
                <FormField control={form.control} name="reworkQty" render={({ field }) => (
                  <Field label="Rework"><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="defectTypeId" render={({ field }) => (
                  <Field label="Primary Defect">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>{defectTypes.map((defect) => <SelectItem key={defect.id} value={defect.id}>{defect.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
                <FormField control={form.control} name="defectCount" render={({ field }) => (
                  <Field label="Defect Count"><FormControl><Input type="number" {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={inspectionMutation.isPending}>{inspectionMutation.isPending ? "Saving..." : editingInspectionId ? "Save Changes" : "Save Inspection"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={capaOpen} onOpenChange={(nextOpen) => (nextOpen ? setCapaOpen(true) : setCapaOpen(false))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCapaId ? "Edit CAPA" : "Add CAPA"}</DialogTitle>
            <DialogDescription>Create and track corrective actions from inspection and vendor quality issues.</DialogDescription>
          </DialogHeader>
          <Form {...capaForm}>
            <form onSubmit={capaForm.handleSubmit((values) => capaMutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={capaForm.control} name="title" render={({ field }) => (
                  <Field label="Title"><FormControl><Input {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
                <FormField control={capaForm.control} name="ownerName" render={({ field }) => (
                  <Field label="Owner"><FormControl><Input {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
                )} />
              </div>
              <FormField control={capaForm.control} name="rootCause" render={({ field }) => (
                <Field label="Root Cause"><FormControl><Input {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={capaForm.control} name="inspectionId" render={({ field }) => (
                  <Field label="Inspection">
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {inspections.map((inspection) => <SelectItem key={inspection.id} value={inspection.id}>{inspection.inspectedAt} • {inspection.stage.replaceAll("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
                <FormField control={capaForm.control} name="status" render={({ field }) => (
                  <Field label="Status">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={capaForm.control} name="vendorId" render={({ field }) => (
                  <Field label="Vendor">
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
                <FormField control={capaForm.control} name="orderId" render={({ field }) => (
                  <Field label="Order">
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {orderOptions.map((order) => <SelectItem key={order.id} value={order.id}>{order.poNumber}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
                <FormField control={capaForm.control} name="lineId" render={({ field }) => (
                  <Field label="Line">
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {lineOptions.map((line) => <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )} />
              </div>
              <FormField control={capaForm.control} name="dueDate" render={({ field }) => (
                <Field label="Due Date"><FormControl><Input type="date" {...field} /></FormControl><FormMessage className="text-[11px]" /></Field>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCapaOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={capaMutation.isPending}>{capaMutation.isPending ? "Saving..." : "Save CAPA"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <FormItem className="space-y-1.5">
      <FormLabel className="text-xs font-medium">{label}</FormLabel>
      {children}
    </FormItem>
  );
}
