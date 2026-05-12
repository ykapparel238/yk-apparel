import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
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
import {
  createGoodsReceipt,
  createInventoryAdjustment,
  createProcurementRequest,
  createSupplierPurchaseOrder,
  fetchInventory,
  fetchProcurementPurchaseOrders,
  fetchProcurementRequests,
  updateProcurementRequest,
  updateSupplierPurchaseOrder,
} from "@/lib/services";
import type { InventoryItem, ProcurementPurchaseOrderItem, ProcurementRequestItem } from "@/lib/types";
import { useForm } from "react-hook-form";
import { AlertTriangle, Pencil, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const adjustmentSchema = z.object({
  deltaQty: z.coerce.number().refine((value) => value !== 0, "Adjustment cannot be zero"),
  reason: z.string().min(2, "Enter a reason"),
});
const procurementSchema = z.object({
  requestedQty: z.coerce.number().positive("Enter a valid quantity"),
  note: z.string().min(2, "Enter a reason"),
  status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]).default("OPEN"),
});
const supplierPoSchema = z.object({
  orderedQty: z.coerce.number().positive("Enter a valid quantity"),
  expectedDate: z.string().optional(),
  note: z.string().min(2, "Enter a note"),
  status: z.enum(["DRAFT", "ISSUED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"]).default("ISSUED"),
});
const receiptSchema = z.object({
  receivedQty: z.coerce.number().positive("Enter a valid quantity"),
  receivedAt: z.string().min(1, "Select a date"),
  note: z.string().min(2, "Enter a note"),
});

type AdjustmentInput = z.infer<typeof adjustmentSchema>;
type ProcurementInput = z.infer<typeof procurementSchema>;
type SupplierPoInput = z.infer<typeof supplierPoSchema>;
type ReceiptInput = z.infer<typeof receiptSchema>;

export default function Inventory() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<InventoryItem | null>(null);
  const [procurementTarget, setProcurementTarget] = useState<InventoryItem | null>(null);
  const [editingProcurement, setEditingProcurement] = useState<ProcurementRequestItem | null>(null);
  const [purchaseOrderTarget, setPurchaseOrderTarget] = useState<ProcurementRequestItem | null>(null);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<ProcurementPurchaseOrderItem | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<ProcurementPurchaseOrderItem | null>(null);
  const inventoryQuery = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
  });
  const procurementQuery = useQuery({
    queryKey: ["procurement-requests"],
    queryFn: fetchProcurementRequests,
  });
  const purchaseOrdersQuery = useQuery({
    queryKey: ["procurement-purchase-orders"],
    queryFn: fetchProcurementPurchaseOrders,
  });

  const form = useForm<AdjustmentInput>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { deltaQty: undefined, reason: "" },
  });
  const procurementForm = useForm<ProcurementInput>({
    resolver: zodResolver(procurementSchema),
    defaultValues: { requestedQty: undefined, note: "", status: "OPEN" },
  });
  const supplierPoForm = useForm<SupplierPoInput>({
    resolver: zodResolver(supplierPoSchema),
    defaultValues: { orderedQty: undefined, expectedDate: "", note: "", status: "ISSUED" },
  });
  const receiptForm = useForm<ReceiptInput>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { receivedQty: undefined, receivedAt: "", note: "" },
  });

  const adjustmentMutation = useMutation({
    mutationFn: (values: AdjustmentInput) =>
      createInventoryAdjustment({ sku: target!.id, deltaQty: values.deltaQty, reason: values.reason }),
    onSuccess: async () => {
      toast.success("Stock adjusted", {
        description: "Inventory balance has been updated.",
      });
      setTarget(null);
      form.reset({ deltaQty: undefined, reason: "" });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["mrp"] });
    },
    onError: (error) => {
      toast.error("Unable to adjust stock", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
  const procurementMutation = useMutation({
    mutationFn: (values: ProcurementInput) => {
      if (editingProcurement) {
        return updateProcurementRequest(editingProcurement.id, values);
      }
      return createProcurementRequest({
        materialId: procurementTarget!.materialId,
        requestedQty: values.requestedQty,
        note: values.note,
      });
    },
    onSuccess: async () => {
      toast.success(editingProcurement ? "Procurement request updated" : "Procurement request created", {
        description: editingProcurement ? "Request status has been updated." : "Shortage has been sent for procurement action.",
      });
      setProcurementTarget(null);
      setEditingProcurement(null);
      procurementForm.reset({ requestedQty: undefined, note: "", status: "OPEN" });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["mrp"] });
      await queryClient.invalidateQueries({ queryKey: ["procurement-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => {
      toast.error("Unable to save procurement request", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
  const purchaseOrderMutation = useMutation({
    mutationFn: (values: SupplierPoInput) => {
      if (editingPurchaseOrder) {
        return updateSupplierPurchaseOrder(editingPurchaseOrder.id, values);
      }
      return createSupplierPurchaseOrder({
        procurementRequestId: purchaseOrderTarget!.id,
        orderedQty: values.orderedQty,
        expectedDate: values.expectedDate || null,
        note: values.note,
      });
    },
    onSuccess: async () => {
      toast.success(editingPurchaseOrder ? "Supplier PO updated" : "Supplier PO created");
      setPurchaseOrderTarget(null);
      setEditingPurchaseOrder(null);
      supplierPoForm.reset({ orderedQty: undefined, expectedDate: "", note: "", status: "ISSUED" });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["procurement-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["procurement-purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => {
      toast.error("Unable to save supplier PO", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
  const receiptMutation = useMutation({
    mutationFn: (values: ReceiptInput) => createGoodsReceipt({
      purchaseOrderId: receiptTarget!.id,
      receivedQty: values.receivedQty,
      receivedAt: values.receivedAt,
      note: values.note,
    }),
    onSuccess: async () => {
      toast.success("Goods receipt posted", {
        description: "Stock and PO receipt balance have been updated.",
      });
      setReceiptTarget(null);
      receiptForm.reset({ receivedQty: undefined, receivedAt: "", note: "" });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["procurement-purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["procurement-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["mrp"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => {
      toast.error("Unable to post goods receipt", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (inventoryQuery.isLoading || procurementQuery.isLoading || purchaseOrdersQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading inventory...</div>;
  }

  if (inventoryQuery.isError || !inventoryQuery.data || procurementQuery.isError || !procurementQuery.data || purchaseOrdersQuery.isError || !purchaseOrdersQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load inventory.</div>;
  }

  const inventory = inventoryQuery.data.items;
  const low = inventoryQuery.data.lowStockCount;
  const procurementRequests = procurementQuery.data.items;
  const purchaseOrders = purchaseOrdersQuery.data.items;

  const openProcurementDialog = (item: InventoryItem) => {
    setProcurementTarget(item);
    const activeRequest = item.activeProcurementRequest;
    if (activeRequest) {
      const found = procurementRequests.find((request) => request.id === activeRequest.id) ?? null;
      setEditingProcurement(found);
      procurementForm.reset({
        requestedQty: found?.requestedQty ?? item.shortage,
        note: found?.note ?? "",
        status: found?.status === "In Progress" ? "IN_PROGRESS" : found?.status === "Closed" ? "CLOSED" : "OPEN",
      });
      return;
    }
    setEditingProcurement(null);
    procurementForm.reset({
      requestedQty: item.shortage || undefined,
      note: `Shortage action for ${item.name}`,
      status: "OPEN",
    });
  };

  const openSupplierPoDialog = (request: ProcurementRequestItem) => {
    setPurchaseOrderTarget(request);
    const existing = purchaseOrders.find((item) => item.procurementRequestId === request.id && ["Draft", "Issued", "Partial Received"].includes(item.status)) ?? null;
    setEditingPurchaseOrder(existing);
    supplierPoForm.reset({
      orderedQty: existing?.orderedQty ?? request.requestedQty,
      expectedDate: existing?.expectedDate ?? "",
      note: existing?.note ?? request.note,
      status: existing?.status === "Received" ? "RECEIVED" : existing?.status === "Partial Received" ? "PARTIAL_RECEIVED" : existing?.status === "Cancelled" ? "CANCELLED" : existing?.status === "Draft" ? "DRAFT" : "ISSUED",
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Stores"
        title="Inventory & Raw Materials"
        description={`${inventory.length} SKUs in stores • ${low} low-stock alerts`}
      />

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold text-right">In Stock</th>
              <th className="px-4 py-3 font-semibold text-right">Allocated</th>
              <th className="px-4 py-3 font-semibold text-right">Free</th>
              <th className="px-4 py-3 font-semibold text-right">Min Level</th>
              <th className="px-4 py-3 font-semibold text-right">Shortage</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold w-40">Stock Health</th>
              <th className="px-4 py-3 font-semibold">Procurement</th>
              <th className="px-4 py-3 font-semibold w-28"></th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => {
              const free = item.stock - item.allocated;
              const lowStock = item.stock <= item.min;
              const healthPct = Math.min(100, Math.round((item.stock / Math.max(1, item.min * 2.5)) * 100));
              return (
                <tr key={item.id} className="data-table-row">
                  <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{item.id}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{item.type}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold">
                    {fmt(item.stock)} <span className="text-[10px] text-muted-foreground font-normal">{item.uom}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-muted-foreground">{fmt(item.allocated)}</td>
                  <td className={`px-4 py-3 text-right font-mono-num font-semibold ${free < 0 ? "text-destructive" : ""}`}>
                    {fmt(free)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-xs text-muted-foreground">{fmt(item.min)}</td>
                  <td className={`px-4 py-3 text-right font-mono-num font-semibold ${item.shortage > 0 ? "text-warning" : "text-muted-foreground"}`}>
                    {fmt(item.shortage)}
                  </td>
                  <td className="px-4 py-3 text-xs">{item.supplier}</td>
                  <td className="px-4 py-3">
                    {lowStock ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-destructive font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" /> Below min
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-success" style={{ width: `${healthPct}%` }} />
                        </div>
                        <span className="text-[11px] font-mono-num text-muted-foreground w-9 text-right">{healthPct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {item.activeProcurementRequest ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                        <ShoppingCart className="h-3.5 w-3.5" /> {item.activeProcurementRequest.status}
                      </span>
                    ) : item.shortage > 0 ? (
                      <span className="text-warning font-medium">Needed</span>
                    ) : (
                      <span className="text-muted-foreground">Covered</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.shortage > 0 ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openProcurementDialog(item)}>
                          {item.activeProcurementRequest ? "Update Req" : "Request"}
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTarget(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden mt-4">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Procurement Requests</h3>
          <p className="text-xs text-muted-foreground">Shortage-driven request tracking for materials</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold text-right">Shortage</th>
              <th className="px-4 py-3 font-semibold text-right">Requested</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold w-28"></th>
            </tr>
          </thead>
          <tbody>
            {procurementRequests.length ? procurementRequests.map((request) => (
              <tr key={request.id} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{request.sku}</td>
                <td className="px-4 py-3 font-medium">{request.material}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{request.supplier}</td>
                <td className="px-4 py-3 text-right font-mono-num text-warning">{fmt(request.shortageQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num">{fmt(request.requestedQty)}</td>
                <td className="px-4 py-3 text-xs">{request.status}</td>
                <td className="px-4 py-3 font-mono-num text-xs text-muted-foreground">{request.createdAt}</td>
                <td className="px-2 py-3 text-right">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openSupplierPoDialog(request)}>
                    {purchaseOrders.some((item) => item.procurementRequestId === request.id) ? "Update PO" : "Create PO"}
                  </Button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No procurement requests created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden mt-4">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Supplier Purchase Orders</h3>
          <p className="text-xs text-muted-foreground">Issued POs and goods receipt progress</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">PO</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold text-right">Ordered</th>
              <th className="px-4 py-3 font-semibold text-right">Received</th>
              <th className="px-4 py-3 font-semibold text-right">Balance</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold w-28"></th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length ? purchaseOrders.map((po) => (
              <tr key={po.id} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{po.poNumber}</td>
                <td className="px-4 py-3 text-xs">{po.supplier}</td>
                <td className="px-4 py-3 text-xs">{po.sku} — {po.material}</td>
                <td className="px-4 py-3 text-right font-mono-num">{fmt(po.orderedQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-success">{fmt(po.receivedQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-warning">{fmt(po.balanceQty)}</td>
                <td className="px-4 py-3 text-xs">{po.status}</td>
                <td className="px-2 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                      setEditingPurchaseOrder(po);
                      setPurchaseOrderTarget(procurementRequests.find((item) => item.id === po.procurementRequestId) ?? null);
                      supplierPoForm.reset({
                        orderedQty: po.orderedQty,
                        expectedDate: po.expectedDate ?? "",
                        note: po.note,
                        status: po.status === "Received" ? "RECEIVED" : po.status === "Partial Received" ? "PARTIAL_RECEIVED" : po.status === "Cancelled" ? "CANCELLED" : po.status === "Draft" ? "DRAFT" : "ISSUED",
                      });
                    }}>Edit</Button>
                    {po.balanceQty > 0 ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                        setReceiptTarget(po);
                        receiptForm.reset({
                          receivedQty: po.balanceQty,
                          receivedAt: new Date().toISOString().slice(0, 10),
                          note: `Receipt for ${po.poNumber}`,
                        });
                      }}>Receive</Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No supplier POs created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              {target ? `Update stock for ${target.name}. Use positive or negative quantity.` : "Adjust stock."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => adjustmentMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="deltaQty"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Adjustment Qty</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="-500 or 1200" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="GRN, correction, issue, wastage..." {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adjustmentMutation.isPending}>
                  {adjustmentMutation.isPending ? "Saving..." : "Save Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(procurementTarget)} onOpenChange={(open) => {
        if (!open) {
          setProcurementTarget(null);
          setEditingProcurement(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProcurement ? "Update Procurement Request" : "Create Procurement Request"}</DialogTitle>
            <DialogDescription>
              {procurementTarget ? `Track shortage action for ${procurementTarget.name}.` : "Track shortage action."}
            </DialogDescription>
          </DialogHeader>
          <Form {...procurementForm}>
            <form onSubmit={procurementForm.handleSubmit((values) => procurementMutation.mutate(values))} className="space-y-4">
              <FormField
                control={procurementForm.control}
                name="requestedQty"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Requested Qty</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={procurementForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Reason / Note</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
              {editingProcurement ? (
                <FormField
                  control={procurementForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-medium">Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setProcurementTarget(null);
                  setEditingProcurement(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={procurementMutation.isPending}>
                  {procurementMutation.isPending ? "Saving..." : editingProcurement ? "Save Request" : "Create Request"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(purchaseOrderTarget || editingPurchaseOrder)} onOpenChange={(open) => {
        if (!open) {
          setPurchaseOrderTarget(null);
          setEditingPurchaseOrder(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPurchaseOrder ? "Update Supplier PO" : "Create Supplier PO"}</DialogTitle>
            <DialogDescription>
              {purchaseOrderTarget ? `Issue supplier purchase order for ${purchaseOrderTarget.material}.` : "Issue supplier purchase order."}
            </DialogDescription>
          </DialogHeader>
          <Form {...supplierPoForm}>
            <form onSubmit={supplierPoForm.handleSubmit((values) => purchaseOrderMutation.mutate(values))} className="space-y-4">
              <FormField control={supplierPoForm.control} name="orderedQty" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium">Ordered Qty</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
              <FormField control={supplierPoForm.control} name="expectedDate" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium">Expected Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
              <FormField control={supplierPoForm.control} name="note" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium">Note</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
              {editingPurchaseOrder ? (
                <FormField control={supplierPoForm.control} name="status" render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-medium">Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ISSUED">Issued</SelectItem>
                        <SelectItem value="PARTIAL_RECEIVED">Partial Received</SelectItem>
                        <SelectItem value="RECEIVED">Received</SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )} />
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setPurchaseOrderTarget(null);
                  setEditingPurchaseOrder(null);
                }}>Cancel</Button>
                <Button type="submit" disabled={purchaseOrderMutation.isPending}>
                  {purchaseOrderMutation.isPending ? "Saving..." : editingPurchaseOrder ? "Save PO" : "Create PO"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receiptTarget)} onOpenChange={(open) => !open && setReceiptTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Post Goods Receipt</DialogTitle>
            <DialogDescription>
              {receiptTarget ? `Receive material against ${receiptTarget.poNumber}.` : "Receive material."}
            </DialogDescription>
          </DialogHeader>
          <Form {...receiptForm}>
            <form onSubmit={receiptForm.handleSubmit((values) => receiptMutation.mutate(values))} className="space-y-4">
              <FormField control={receiptForm.control} name="receivedQty" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium">Received Qty</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
              <FormField control={receiptForm.control} name="receivedAt" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium">Receipt Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
              <FormField control={receiptForm.control} name="note" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-medium">Note</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReceiptTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={receiptMutation.isPending}>
                  {receiptMutation.isPending ? "Posting..." : "Post Receipt"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
