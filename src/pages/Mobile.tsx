import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, ClipboardCheck, Factory, PackageCheck, Truck, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/context/RoleContext";
import {
  createInventoryAdjustment,
  createCapa,
  createGoodsReceipt,
  createProductionEntry,
  createQaInspection,
  createShipment,
  fetchMobileToday,
  issueVendorChallan,
  updateProcurementRequest,
  updateShipment,
  updateSupplierPurchaseOrder,
  updateVendorChallan,
} from "@/lib/services";
import type { MobileTodayPayload } from "@/lib/types";
import { toast } from "sonner";

type ActionType = MobileTodayPayload["actions"][number]["type"];
type MobileActionConfig = MobileTodayPayload["actions"][number];
type ProductionEntryPayload = Parameters<typeof createProductionEntry>[0];
type QaInspectionPayload = Parameters<typeof createQaInspection>[0];
type InventoryAdjustmentPayload = Parameters<typeof createInventoryAdjustment>[0];
type DispatchShipmentPayload = Parameters<typeof createShipment>[0];
type CapaPayload = Parameters<typeof createCapa>[0];
type GoodsReceiptPayload = Parameters<typeof createGoodsReceipt>[0];
type ProcurementUpdatePayload = { id: string; requestedQty?: number; note?: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED" };
type SupplierPoUpdatePayload = { id: string; orderedQty?: number; expectedDate?: string | null; note?: string | null; status?: "DRAFT" | "ISSUED" | "PARTIAL_RECEIVED" | "RECEIVED" | "CANCELLED" };
type DispatchShipmentUpdatePayload = Parameters<typeof updateShipment>[1] & { id: string };
type VendorIssueChallanPayload = Parameters<typeof issueVendorChallan>[1] & { vendorId: string };
type VendorChallanPayload = { vendorId: string; challanId: string; inwardQty: number; rejectedQty: number };
type MobileSubmitPayload =
  | ProductionEntryPayload
  | QaInspectionPayload
  | InventoryAdjustmentPayload
  | DispatchShipmentPayload
  | VendorChallanPayload
  | CapaPayload
  | GoodsReceiptPayload
  | ProcurementUpdatePayload
  | SupplierPoUpdatePayload
  | DispatchShipmentUpdatePayload
  | VendorIssueChallanPayload;

const today = () => new Date().toISOString().slice(0, 10);

export default function Mobile() {
  const { role, user } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionDefaults, setActionDefaults] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["mobile-today"], queryFn: fetchMobileToday });
  const payload = query.data;

  const openAction = (type: ActionType, defaults: Record<string, string> = {}) => {
    setActionDefaults(defaults);
    setActionType(type);
  };

  const closeAction = () => {
    setActionDefaults({});
    setActionType(null);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mobile-today"] });
  };

  const productionMutation = useMutation({
    mutationFn: createProductionEntry,
    onSuccess: async () => {
      toast.success("Production entry saved");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to save production entry"),
  });
  const qaMutation = useMutation({
    mutationFn: createQaInspection,
    onSuccess: async () => {
      toast.success("QA inspection saved");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to save QA inspection"),
  });
  const capaMutation = useMutation({
    mutationFn: createCapa,
    onSuccess: async () => {
      toast.success("CAPA saved");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to save CAPA"),
  });
  const stockMutation = useMutation({
    mutationFn: createInventoryAdjustment,
    onSuccess: async () => {
      toast.success("Stock adjustment saved");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to save stock adjustment"),
  });
  const procurementMutation = useMutation({
    mutationFn: ({ id, ...values }: ProcurementUpdatePayload) => updateProcurementRequest(id, values),
    onSuccess: async () => {
      toast.success("Procurement request updated");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update procurement request"),
  });
  const supplierPoMutation = useMutation({
    mutationFn: ({ id, ...values }: SupplierPoUpdatePayload) => updateSupplierPurchaseOrder(id, values),
    onSuccess: async () => {
      toast.success("Supplier PO updated");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update supplier PO"),
  });
  const goodsReceiptMutation = useMutation({
    mutationFn: createGoodsReceipt,
    onSuccess: async () => {
      toast.success("Goods receipt posted");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to post goods receipt"),
  });
  const vendorIssueMutation = useMutation({
    mutationFn: ({ vendorId, ...values }: VendorIssueChallanPayload) => issueVendorChallan(vendorId, values),
    onSuccess: async () => {
      toast.success("Vendor challan issued");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to issue challan"),
  });
  const challanMutation = useMutation({
    mutationFn: ({ vendorId, challanId, inwardQty, rejectedQty }: { vendorId: string; challanId: string; inwardQty: number; rejectedQty: number }) =>
      updateVendorChallan(vendorId, challanId, { inwardQty, rejectedQty }),
    onSuccess: async () => {
      toast.success("Vendor challan updated");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to update challan"),
  });
  const dispatchMutation = useMutation({
    mutationFn: createShipment,
    onSuccess: async () => {
      toast.success("Dispatch scheduled");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to schedule dispatch"),
  });
  const dispatchUpdateMutation = useMutation({
    mutationFn: ({ id, ...values }: DispatchShipmentUpdatePayload) => updateShipment(id, values),
    onSuccess: async () => {
      toast.success("Shipment corrected");
      closeAction();
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to correct shipment"),
  });

  if (query.isLoading) {
    return <div className="min-h-screen bg-background p-6 text-center text-sm text-muted-foreground">Loading mobile work queue...</div>;
  }

  if (query.isError || !payload) {
    return <div className="min-h-screen bg-background p-6 text-center text-sm text-destructive">Unable to load mobile work queue.</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{payload.date} / {role}</div>
            <h1 className="text-lg font-bold">Daily Work</h1>
            <p className="text-xs text-muted-foreground">{user?.name ?? "User"} · online-only mobile entry</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>Desktop</Button>
        </div>
      </header>

      <main className="space-y-4 p-4">
        <section className="grid grid-cols-1 gap-3">
          {payload.cards.map((item) => (
            <MobileTaskCard key={item.id} card={item} onAction={openAction} />
          ))}
        </section>

        {payload.workItems.length ? (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Priority work</h2>
                <p className="mt-1 text-xs text-muted-foreground">Tap a task to open the right form already filled in.</p>
              </div>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{payload.workItems.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {payload.workItems.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  className="w-full rounded-xl border border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                  onClick={() => openAction(item.action.type, item.action.defaults ?? {})}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold">{item.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{item.subtitle}</div>
                    </div>
                    <span className={`rounded px-2 py-1 text-[10px] font-semibold ${toneClass(item.tone)}`}>{item.action.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {payload.actions.length ? (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Quick actions</h2>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {payload.actions.map((item) => (
                <Button key={item.id} className="h-12 justify-start rounded-xl" variant={item.tone === "primary" ? "default" : "outline"} onClick={() => openAction(item.type, item.defaults ?? {})}>
                  {iconFor(item.type)}
                  {item.label}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Alerts</h2>
          <div className="mt-3 space-y-2">
            {payload.alerts.length ? payload.alerts.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium">{item.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{item.module} · {item.severity} · {item.time}</div>
              </div>
            )) : <div className="text-xs text-muted-foreground">No active alerts for your role.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Recent today</h2>
          <div className="mt-3 space-y-2">
            {payload.recent.length ? payload.recent.slice(0, 8).map((item) => (
              <button key={`${item.type}-${item.id}`} className="w-full rounded-xl border border-border bg-muted/20 p-3 text-left" onClick={() => navigate(item.route)}>
                <div className="text-xs font-medium">{item.title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{item.subtitle}</div>
              </button>
            )) : <div className="text-xs text-muted-foreground">No entries recorded yet today.</div>}
          </div>
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 py-2 backdrop-blur">
        <div className="grid grid-cols-4 gap-2 text-[10px]">
          <Button variant="ghost" className="h-12 flex-col gap-1" onClick={() => navigate("/mobile")}><CalendarDays className="h-4 w-4" />Today</Button>
          <Button variant="ghost" className="h-12 flex-col gap-1" onClick={() => navigate("/")}><CheckCircle2 className="h-4 w-4" />Dash</Button>
          <Button variant="ghost" className="h-12 flex-col gap-1" onClick={() => navigate("/reports")}><ClipboardCheck className="h-4 w-4" />Reports</Button>
          <Button variant="ghost" className="h-12 flex-col gap-1" onClick={() => navigate("/settings")}><Users2 className="h-4 w-4" />Admin</Button>
        </div>
      </nav>

      <MobileActionDialog
        type={actionType}
        defaults={actionDefaults}
        payload={payload}
        pending={productionMutation.isPending || qaMutation.isPending || capaMutation.isPending || stockMutation.isPending || procurementMutation.isPending || supplierPoMutation.isPending || goodsReceiptMutation.isPending || vendorIssueMutation.isPending || challanMutation.isPending || dispatchMutation.isPending || dispatchUpdateMutation.isPending}
        onClose={closeAction}
        onSubmit={(type, values) => {
          if (type === "productionEntry") productionMutation.mutate(values as ProductionEntryPayload);
          if (type === "qaInspection") qaMutation.mutate(values as QaInspectionPayload);
          if (type === "qaCapa") capaMutation.mutate(values as CapaPayload);
          if (type === "inventoryAdjustment") stockMutation.mutate(values as InventoryAdjustmentPayload);
          if (type === "procurementRequestUpdate") procurementMutation.mutate(values as ProcurementUpdatePayload);
          if (type === "supplierPoUpdate") supplierPoMutation.mutate(values as SupplierPoUpdatePayload);
          if (type === "goodsReceipt") goodsReceiptMutation.mutate(values as GoodsReceiptPayload);
          if (type === "vendorIssueChallan") vendorIssueMutation.mutate(values as VendorIssueChallanPayload);
          if (type === "vendorChallan") challanMutation.mutate(values as VendorChallanPayload);
          if (type === "dispatchShipment") dispatchMutation.mutate(values as DispatchShipmentPayload);
          if (type === "dispatchShipmentUpdate") dispatchUpdateMutation.mutate(values as DispatchShipmentUpdatePayload);
        }}
      />
    </div>
  );
}

function MobileTaskCard({ card, onAction }: { card: MobileTodayPayload["cards"][number]; onAction: (type: ActionType, defaults?: Record<string, string>) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{card.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${card.tone === "warning" ? "bg-warning/15 text-warning" : card.tone === "success" ? "bg-success/15 text-success" : "bg-primary-soft text-primary"}`}>
          {card.count}
        </span>
      </div>
      {card.actions.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.actions.map((item) => (
            <Button key={item.id} size="sm" className="h-10 rounded-xl" onClick={() => onAction(item.type, item.defaults ?? {})}>{item.label}</Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileActionDialog({
  type,
  defaults,
  payload,
  pending,
  onClose,
  onSubmit,
}: {
  type: ActionType | null;
  defaults: Record<string, string>;
  payload: MobileTodayPayload;
  pending: boolean;
  onClose: () => void;
  onSubmit: (type: ActionType, values: MobileSubmitPayload) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const open = Boolean(type);

  useEffect(() => {
    setValues(defaults);
  }, [type, defaults]);

  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const close = () => {
    setValues({});
    onClose();
  };
  const submit = () => {
    if (!type) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline. Mobile writes require internet.");
      return;
    }
    const validationMessage = validateMobileAction(type, values);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    if (type === "productionEntry") {
      onSubmit(type, {
        metricDate: values.metricDate || today(),
        lineId: values.lineId || payload.options.lines[0]?.id || "",
        orderId: values.orderId || null,
        shiftId: values.shiftId || null,
        stage: values.stage || "KNITTING",
        plannedQty: Number(values.plannedQty || 0),
        actualQty: Number(values.actualQty || 0),
        rejectedQty: Number(values.rejectedQty || 0),
        downtimeMinutes: Number(values.downtimeMinutes || 0),
        downtimeReasonId: values.downtimeReasonId || null,
        remarks: values.remarks || null,
      });
    }
    if (type === "qaInspection") {
      onSubmit(type, {
        inspectedAt: values.inspectedAt || today(),
        orderId: values.orderId || null,
        vendorId: values.vendorId || null,
        lineId: values.lineId || null,
        stage: values.stage || "QUALITY_CHECK",
        checkedQty: Number(values.checkedQty || 0),
        approvedQty: Number(values.approvedQty || 0),
        rejectedQty: Number(values.rejectedQty || 0),
        reworkQty: Number(values.reworkQty || 0),
        defects: values.defectTypeId && Number(values.defectCount || 0) > 0 ? [{ defectTypeId: values.defectTypeId, count: Number(values.defectCount) }] : [],
      });
    }
    if (type === "qaCapa") {
      onSubmit(type, {
        inspectionId: values.inspectionId || null,
        vendorId: values.vendorId || null,
        orderId: values.orderId || null,
        lineId: values.lineId || null,
        title: values.title || "Mobile CAPA",
        rootCause: values.rootCause || "Pending investigation",
        ownerName: values.ownerName || "QA",
        dueDate: values.dueDate || today(),
        status: (values.status || "OPEN") as CapaPayload["status"],
      });
    }
    if (type === "inventoryAdjustment") {
      onSubmit(type, { sku: values.sku || "", deltaQty: Number(values.deltaQty || 0), reason: values.reason || "Mobile stock update" });
    }
    if (type === "procurementRequestUpdate") {
      onSubmit(type, {
        id: values.requestId || "",
        requestedQty: values.requestedQty ? Number(values.requestedQty) : undefined,
        note: values.note || undefined,
        status: (values.status || "IN_PROGRESS") as ProcurementUpdatePayload["status"],
      });
    }
    if (type === "supplierPoUpdate") {
      onSubmit(type, {
        id: values.purchaseOrderId || "",
        orderedQty: values.orderedQty ? Number(values.orderedQty) : undefined,
        expectedDate: values.expectedDate || null,
        note: values.note || undefined,
        status: values.status as SupplierPoUpdatePayload["status"],
      });
    }
    if (type === "goodsReceipt") {
      onSubmit(type, {
        purchaseOrderId: values.purchaseOrderId || "",
        receivedQty: Number(values.receivedQty || 0),
        receivedAt: values.receivedAt || today(),
        note: values.note || null,
      });
    }
    if (type === "vendorIssueChallan") {
      onSubmit(type, {
        vendorId: values.vendorId || "",
        orderId: values.orderId || "",
        challanDate: values.challanDate || today(),
        outwardQty: Number(values.outwardQty || 0),
      });
    }
    if (type === "vendorChallan") {
      const challan = payload.options.challans.find((item) => item.id === values.challanId);
      onSubmit(type, { vendorId: challan?.vendorId ?? "", challanId: values.challanId || "", inwardQty: Number(values.inwardQty || 0), rejectedQty: Number(values.rejectedQty || 0) });
    }
    if (type === "dispatchShipment") {
      onSubmit(type, { orderId: values.orderId || "", dispatchDate: values.dispatchDate || today(), quantity: Number(values.quantity || 0), invoiceNumber: values.invoiceNumber || "" });
    }
    if (type === "dispatchShipmentUpdate") {
      onSubmit(type, {
        id: values.shipmentId || "",
        dispatchDate: values.dispatchDate || today(),
        quantity: Number(values.quantity || 0),
        invoiceNumber: values.invoiceNumber || "",
        status: values.status as DispatchShipmentUpdatePayload["status"],
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titleFor(type)}</DialogTitle>
          <DialogDescription>Online-only mobile entry. Save once, request admin approval for later corrections.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {type === "productionEntry" ? <ProductionFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "qaInspection" ? <QaFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "qaCapa" ? <CapaFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "inventoryAdjustment" ? <InventoryFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "procurementRequestUpdate" ? <ProcurementFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "supplierPoUpdate" ? <SupplierPoFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "goodsReceipt" ? <GoodsReceiptFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "vendorIssueChallan" ? <VendorIssueFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "vendorChallan" ? <ChallanFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "dispatchShipment" ? <DispatchFields payload={payload} values={values} setValue={setValue} /> : null}
          {type === "dispatchShipmentUpdate" ? <DispatchUpdateFields payload={payload} values={values} setValue={setValue} /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button disabled={pending} onClick={submit}>{pending ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label className="text-xs font-medium">{label}</label>{children}</div>;
}

function SelectField({ value, onChange, placeholder, items }: { value?: string; onChange: (value: string) => void; placeholder: string; items: Array<{ id: string; label: string }> }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function ProductionFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Date"><Input type="date" value={values.metricDate || today()} onChange={(e) => setValue("metricDate", e.target.value)} /></Field>
      <Field label="Line"><SelectField value={values.lineId} onChange={(v) => setValue("lineId", v)} placeholder="Select line" items={payload.options.lines.map((item) => ({ id: item.id, label: item.name }))} /></Field>
      <Field label="Order"><SelectField value={values.orderId} onChange={(v) => setValue("orderId", v)} placeholder="Optional PO" items={payload.options.orders.map((item) => ({ id: item.id, label: item.poNumber }))} /></Field>
      <Field label="Shift"><SelectField value={values.shiftId} onChange={(v) => setValue("shiftId", v)} placeholder="Optional shift" items={payload.options.shifts.map((item) => ({ id: item.id, label: item.name }))} /></Field>
      <Field label="Stage"><SelectField value={values.stage} onChange={(v) => setValue("stage", v)} placeholder="Stage" items={stageItems()} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Planned"><Input inputMode="numeric" value={values.plannedQty || ""} onChange={(e) => setValue("plannedQty", e.target.value)} /></Field>
        <Field label="Actual"><Input inputMode="numeric" value={values.actualQty || ""} onChange={(e) => setValue("actualQty", e.target.value)} /></Field>
        <Field label="Rejected"><Input inputMode="numeric" value={values.rejectedQty || ""} onChange={(e) => setValue("rejectedQty", e.target.value)} /></Field>
        <Field label="Downtime min"><Input inputMode="numeric" value={values.downtimeMinutes || ""} onChange={(e) => setValue("downtimeMinutes", e.target.value)} /></Field>
      </div>
      <Field label="Remarks"><Textarea value={values.remarks || ""} onChange={(e) => setValue("remarks", e.target.value)} /></Field>
    </>
  );
}

function QaFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Date"><Input type="date" value={values.inspectedAt || today()} onChange={(e) => setValue("inspectedAt", e.target.value)} /></Field>
      <Field label="Order"><SelectField value={values.orderId} onChange={(v) => setValue("orderId", v)} placeholder="Optional PO" items={payload.options.orders.map((item) => ({ id: item.id, label: item.poNumber }))} /></Field>
      <Field label="Stage"><SelectField value={values.stage} onChange={(v) => setValue("stage", v)} placeholder="Stage" items={stageItems()} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Checked"><Input inputMode="numeric" value={values.checkedQty || ""} onChange={(e) => setValue("checkedQty", e.target.value)} /></Field>
        <Field label="Approved"><Input inputMode="numeric" value={values.approvedQty || ""} onChange={(e) => setValue("approvedQty", e.target.value)} /></Field>
        <Field label="Rejected"><Input inputMode="numeric" value={values.rejectedQty || ""} onChange={(e) => setValue("rejectedQty", e.target.value)} /></Field>
        <Field label="Rework"><Input inputMode="numeric" value={values.reworkQty || ""} onChange={(e) => setValue("reworkQty", e.target.value)} /></Field>
      </div>
      <Field label="Defect type"><SelectField value={values.defectTypeId} onChange={(v) => setValue("defectTypeId", v)} placeholder="Optional defect" items={payload.options.defectTypes.map((item) => ({ id: item.id, label: item.name }))} /></Field>
      <Field label="Defect count"><Input inputMode="numeric" value={values.defectCount || ""} onChange={(e) => setValue("defectCount", e.target.value)} /></Field>
    </>
  );
}

function CapaFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Title"><Input value={values.title || ""} onChange={(e) => setValue("title", e.target.value)} placeholder="Issue title" /></Field>
      <Field label="Owner"><Input value={values.ownerName || ""} onChange={(e) => setValue("ownerName", e.target.value)} placeholder="Responsible person" /></Field>
      <Field label="Root cause"><Textarea value={values.rootCause || ""} onChange={(e) => setValue("rootCause", e.target.value)} /></Field>
      <Field label="Related inspection"><SelectField value={values.inspectionId} onChange={(v) => setValue("inspectionId", v)} placeholder="Optional inspection" items={payload.options.qaInspections.map((item) => ({ id: item.id, label: item.label }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date"><Input type="date" value={values.dueDate || today()} onChange={(e) => setValue("dueDate", e.target.value)} /></Field>
        <Field label="Status"><SelectField value={values.status} onChange={(v) => setValue("status", v)} placeholder="Status" items={["OPEN", "IN_PROGRESS", "CLOSED"].map((id) => ({ id, label: id.replaceAll("_", " ") }))} /></Field>
      </div>
    </>
  );
}

function InventoryFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Material"><SelectField value={values.sku} onChange={(v) => setValue("sku", v)} placeholder="Select SKU" items={payload.options.materials.map((item) => ({ id: item.sku, label: `${item.sku} · ${item.name}` }))} /></Field>
      <Field label="Adjustment quantity"><Input inputMode="numeric" placeholder="-50 or 100" value={values.deltaQty || ""} onChange={(e) => setValue("deltaQty", e.target.value)} /></Field>
      <Field label="Reason"><Textarea value={values.reason || ""} onChange={(e) => setValue("reason", e.target.value)} /></Field>
    </>
  );
}

function ProcurementFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Request"><SelectField value={values.requestId} onChange={(v) => setValue("requestId", v)} placeholder="Select request" items={payload.options.procurementRequests.map((item) => ({ id: item.id, label: `${item.sku} · ${item.material} · ${item.requestedQty}` }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Requested qty"><Input inputMode="numeric" value={values.requestedQty || ""} onChange={(e) => setValue("requestedQty", e.target.value)} /></Field>
        <Field label="Status"><SelectField value={values.status} onChange={(v) => setValue("status", v)} placeholder="Status" items={["OPEN", "IN_PROGRESS", "CLOSED"].map((id) => ({ id, label: id.replaceAll("_", " ") }))} /></Field>
      </div>
      <Field label="Note"><Textarea value={values.note || ""} onChange={(e) => setValue("note", e.target.value)} /></Field>
    </>
  );
}

function SupplierPoFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Supplier PO"><SelectField value={values.purchaseOrderId} onChange={(v) => setValue("purchaseOrderId", v)} placeholder="Select PO" items={payload.options.supplierPurchaseOrders.map((item) => ({ id: item.id, label: `${item.poNumber} · ${item.material} · Bal ${item.balanceQty}` }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ordered qty"><Input inputMode="numeric" value={values.orderedQty || ""} onChange={(e) => setValue("orderedQty", e.target.value)} /></Field>
        <Field label="Expected"><Input type="date" value={values.expectedDate || ""} onChange={(e) => setValue("expectedDate", e.target.value)} /></Field>
      </div>
      <Field label="Status"><SelectField value={values.status} onChange={(v) => setValue("status", v)} placeholder="Status" items={["ISSUED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"].map((id) => ({ id, label: id.replaceAll("_", " ") }))} /></Field>
      <Field label="Note"><Textarea value={values.note || ""} onChange={(e) => setValue("note", e.target.value)} /></Field>
    </>
  );
}

function GoodsReceiptFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Supplier PO"><SelectField value={values.purchaseOrderId} onChange={(v) => setValue("purchaseOrderId", v)} placeholder="Select PO" items={payload.options.supplierPurchaseOrders.map((item) => ({ id: item.id, label: `${item.poNumber} · ${item.supplier} · Bal ${item.balanceQty}` }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Received qty"><Input inputMode="numeric" value={values.receivedQty || ""} onChange={(e) => setValue("receivedQty", e.target.value)} /></Field>
        <Field label="Received at"><Input type="date" value={values.receivedAt || today()} onChange={(e) => setValue("receivedAt", e.target.value)} /></Field>
      </div>
      <Field label="Note"><Textarea value={values.note || ""} onChange={(e) => setValue("note", e.target.value)} /></Field>
    </>
  );
}

function VendorIssueFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Vendor"><SelectField value={values.vendorId} onChange={(v) => setValue("vendorId", v)} placeholder="Select vendor" items={payload.options.vendors.map((item) => ({ id: item.id, label: item.name }))} /></Field>
      <Field label="Order"><SelectField value={values.orderId} onChange={(v) => setValue("orderId", v)} placeholder="Select PO" items={payload.options.orders.map((item) => ({ id: item.id, label: item.poNumber }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Challan date"><Input type="date" value={values.challanDate || today()} onChange={(e) => setValue("challanDate", e.target.value)} /></Field>
        <Field label="Outward qty"><Input inputMode="numeric" value={values.outwardQty || ""} onChange={(e) => setValue("outwardQty", e.target.value)} /></Field>
      </div>
    </>
  );
}

function ChallanFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Challan"><SelectField value={values.challanId} onChange={(v) => setValue("challanId", v)} placeholder="Select challan" items={payload.options.challans.map((item) => ({ id: item.id, label: `${item.challanNumber} · ${item.vendor} · ${item.orderPo}` }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inward qty"><Input inputMode="numeric" value={values.inwardQty || ""} onChange={(e) => setValue("inwardQty", e.target.value)} /></Field>
        <Field label="Rejected qty"><Input inputMode="numeric" value={values.rejectedQty || ""} onChange={(e) => setValue("rejectedQty", e.target.value)} /></Field>
      </div>
    </>
  );
}

function DispatchFields({ payload, values, setValue }: FieldProps) {
  return (
    <>
      <Field label="Order"><SelectField value={values.orderId} onChange={(v) => setValue("orderId", v)} placeholder="Select order" items={payload.options.dispatchOrders.map((item) => ({ id: item.id, label: `${item.poNumber} · ${item.remaining} left` }))} /></Field>
      <Field label="Dispatch date"><Input type="date" value={values.dispatchDate || today()} onChange={(e) => setValue("dispatchDate", e.target.value)} /></Field>
      <Field label="Quantity"><Input inputMode="numeric" value={values.quantity || ""} onChange={(e) => setValue("quantity", e.target.value)} /></Field>
      <Field label="Invoice number"><Input value={values.invoiceNumber || ""} onChange={(e) => setValue("invoiceNumber", e.target.value)} /></Field>
    </>
  );
}

function DispatchUpdateFields({ payload, values, setValue }: FieldProps) {
  const selected = payload.options.dispatchShipments.find((item) => item.id === values.shipmentId);
  return (
    <>
      <Field label="Shipment"><SelectField value={values.shipmentId} onChange={(v) => {
        const shipment = payload.options.dispatchShipments.find((item) => item.id === v);
        setValue("shipmentId", v);
        if (shipment) {
          setValue("dispatchDate", shipment.dispatchDate);
          setValue("quantity", String(shipment.quantity));
          setValue("invoiceNumber", shipment.invoiceNumber);
          setValue("status", shipment.status);
        }
      }} placeholder="Select shipment" items={payload.options.dispatchShipments.map((item) => ({ id: item.id, label: item.label }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dispatch date"><Input type="date" value={values.dispatchDate || selected?.dispatchDate || today()} onChange={(e) => setValue("dispatchDate", e.target.value)} /></Field>
        <Field label="Quantity"><Input inputMode="numeric" value={values.quantity || (selected ? String(selected.quantity) : "")} onChange={(e) => setValue("quantity", e.target.value)} /></Field>
      </div>
      <Field label="Invoice number"><Input value={values.invoiceNumber || selected?.invoiceNumber || ""} onChange={(e) => setValue("invoiceNumber", e.target.value)} /></Field>
      <Field label="Status"><SelectField value={values.status || selected?.status} onChange={(v) => setValue("status", v)} placeholder="Status" items={["READY", "SCHEDULED", "DISPATCHED", "CANCELLED"].map((id) => ({ id, label: id.replaceAll("_", " ") }))} /></Field>
    </>
  );
}

type FieldProps = {
  payload: MobileTodayPayload;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
};

function stageItems() {
  return [
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
  ].map((id) => ({ id, label: id.replaceAll("_", " ") }));
}

function titleFor(type: ActionType | null) {
  if (type === "productionEntry") return "Add Production Actuals";
  if (type === "qaInspection") return "Add QA Inspection";
  if (type === "qaCapa") return "Raise CAPA";
  if (type === "inventoryAdjustment") return "Adjust Stock";
  if (type === "procurementRequestUpdate") return "Update Procurement";
  if (type === "supplierPoUpdate") return "Update Supplier PO";
  if (type === "goodsReceipt") return "Post Goods Receipt";
  if (type === "vendorIssueChallan") return "Issue Vendor Challan";
  if (type === "vendorChallan") return "Update Vendor Challan";
  if (type === "dispatchShipment") return "Schedule Dispatch";
  if (type === "dispatchShipmentUpdate") return "Correct Shipment";
  return "Mobile Entry";
}

function validateMobileAction(type: ActionType, values: Record<string, string>) {
  const requiredByType: Partial<Record<ActionType, Array<[string, string]>>> = {
    productionEntry: [["lineId", "Select a production line"], ["actualQty", "Enter actual quantity"]],
    qaInspection: [["checkedQty", "Enter checked quantity"]],
    qaCapa: [["title", "Enter a CAPA title"], ["rootCause", "Enter root cause"], ["ownerName", "Enter owner"]],
    inventoryAdjustment: [["sku", "Select a material"], ["deltaQty", "Enter adjustment quantity"]],
    procurementRequestUpdate: [["requestId", "Select a procurement request"]],
    supplierPoUpdate: [["purchaseOrderId", "Select a supplier PO"]],
    goodsReceipt: [["purchaseOrderId", "Select a supplier PO"], ["receivedQty", "Enter received quantity"]],
    vendorIssueChallan: [["vendorId", "Select a vendor"], ["orderId", "Select an order"], ["outwardQty", "Enter outward quantity"]],
    vendorChallan: [["challanId", "Select a challan"]],
    dispatchShipment: [["orderId", "Select a dispatch order"], ["quantity", "Enter shipment quantity"]],
    dispatchShipmentUpdate: [["shipmentId", "Select a shipment"], ["quantity", "Enter shipment quantity"]],
  };
  const missing = requiredByType[type]?.find(([key]) => !values[key]);
  if (missing) return missing[1];
  const numericFields = ["actualQty", "checkedQty", "deltaQty", "receivedQty", "outwardQty", "quantity"];
  const invalidNumber = numericFields.find((key) => values[key] !== undefined && (!Number.isFinite(Number(values[key])) || Number(values[key]) === 0));
  if (invalidNumber) return "Enter a valid non-zero quantity.";
  return null;
}

function iconFor(type: ActionType) {
  const className = "mr-2 h-4 w-4";
  if (type === "productionEntry") return <Factory className={className} />;
  if (type === "qaInspection") return <ClipboardCheck className={className} />;
  if (type === "qaCapa") return <ClipboardCheck className={className} />;
  if (type === "inventoryAdjustment") return <PackageCheck className={className} />;
  if (type === "procurementRequestUpdate") return <PackageCheck className={className} />;
  if (type === "supplierPoUpdate") return <PackageCheck className={className} />;
  if (type === "goodsReceipt") return <PackageCheck className={className} />;
  if (type === "vendorIssueChallan") return <Users2 className={className} />;
  if (type === "vendorChallan") return <Users2 className={className} />;
  if (type === "dispatchShipment") return <Truck className={className} />;
  if (type === "dispatchShipmentUpdate") return <Truck className={className} />;
  return <CheckCircle2 className={className} />;
}

function toneClass(tone: string) {
  if (tone === "warning") return "bg-warning/15 text-warning";
  if (tone === "success") return "bg-success/15 text-success";
  if (tone === "destructive" || tone === "critical") return "bg-destructive/15 text-destructive";
  return "bg-primary-soft text-primary";
}
