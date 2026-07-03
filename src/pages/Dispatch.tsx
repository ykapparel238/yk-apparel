import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { PoAttachmentUploader } from "@/components/PoAttachmentUploader";
import { StatusBadge } from "@/components/StatusBadge";
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
import { createShipment, fetchDispatch, updateShipment } from "@/lib/services";
import { uploadPoAttachments, type PendingPoUpload } from "@/lib/assetUploads";
import type { DispatchItem } from "@/lib/types";
import { Truck, FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

const shipmentSchema = z.object({
  dispatchDate: z.string().min(1, "Select a dispatch date"),
  quantity: z.coerce.number().int().positive("Enter a valid quantity"),
  invoiceNumber: z.string().optional(),
  status: z.enum(["READY", "SCHEDULED", "DISPATCHED", "CANCELLED"]).default("SCHEDULED"),
});

type ShipmentInput = z.infer<typeof shipmentSchema>;

export default function Dispatch() {
  const location = useLocation();
  const navigate = useNavigate();
  const [target, setTarget] = useState<DispatchItem | null>(null);
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);
  const [reportUploads, setReportUploads] = useState<PendingPoUpload[]>([]);
  const queryClient = useQueryClient();
  const routeState = location.state as { openDispatchForOrderId?: string } | null;
  const dispatchQuery = useQuery({
    queryKey: ["dispatch"],
    queryFn: fetchDispatch,
  });
  const fmt = (n: number) => n.toLocaleString("en-IN");

  const form = useForm<ShipmentInput>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: { dispatchDate: "", quantity: undefined, invoiceNumber: "", status: "SCHEDULED" },
  });

  const resetDialog = () => {
    setTarget(null);
    setEditingShipmentId(null);
    setReportUploads([]);
    form.reset({ dispatchDate: "", quantity: undefined, invoiceNumber: "", status: "SCHEDULED" });
  };

  const openCreate = useCallback((order: DispatchItem) => {
    setTarget(order);
    setEditingShipmentId(null);
    setReportUploads([]);
    form.reset({ dispatchDate: "", quantity: order.remaining || undefined, invoiceNumber: "", status: "SCHEDULED" });
  }, [form]);

  const openEdit = (order: DispatchItem) => {
    if (!order.latestShipment) return;
    setTarget(order);
    setEditingShipmentId(order.latestShipment.id);
    setReportUploads([]);
    form.reset({
      dispatchDate: order.latestShipment.dispatchDate,
      quantity: order.latestShipment.quantity,
      invoiceNumber: order.latestShipment.invoiceNumber ?? "",
      status: normalizeShipmentStatus(order.latestShipment.status),
    });
  };

  const shipmentMutation = useMutation({
    mutationFn: (values: ShipmentInput) => {
      if (editingShipmentId) {
        return updateShipment(editingShipmentId, {
          dispatchDate: values.dispatchDate,
          quantity: values.quantity,
          invoiceNumber: values.invoiceNumber,
          status: values.status,
        });
      }
      return createShipment({
        orderId: target!.id,
        dispatchDate: values.dispatchDate,
        quantity: values.quantity,
        invoiceNumber: values.invoiceNumber,
        status: values.status,
      });
    },
    onSuccess: async () => {
      if (target?.id && reportUploads.length) {
        try {
          await uploadPoAttachments(target.id, reportUploads);
        } catch (error) {
          toast.error("Shipment saved, but report photo did not upload", {
            description: error instanceof Error ? error.message : "Open the PO and try uploading again.",
          });
        }
      }
      toast.success(editingShipmentId ? "Shipment updated" : "Dispatch scheduled", {
        description: editingShipmentId ? "Shipment changes have been saved." : "Shipment has been recorded.",
      });
      resetDialog();
      await queryClient.invalidateQueries({ queryKey: ["dispatch"] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
    onError: (error) => {
      toast.error("Unable to save shipment", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const ready = useMemo(() => dispatchQuery.data?.items ?? [], [dispatchQuery.data?.items]);

  useEffect(() => {
    if (!routeState?.openDispatchForOrderId) return;
    const order = ready.find((item) => item.id === routeState.openDispatchForOrderId);
    if (order) openCreate(order);
    navigate(location.pathname, { replace: true, state: null });
  }, [routeState?.openDispatchForOrderId, ready, openCreate, navigate, location.pathname]);

  if (dispatchQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading dispatch...</div>;
  }

  if (dispatchQuery.isError || !dispatchQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load dispatch.</div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Logistics"
        title="Dispatch & Shipment"
        description="Packing list, dispatch planning, brand delivery tracking"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Packing List
            </Button>
            <Button size="sm" className="h-9" disabled={!ready.length} onClick={() => ready[0] && openCreate(ready[0])}>
              <Truck className="h-3.5 w-3.5 mr-1.5" /> Schedule Dispatch
            </Button>
          </>
        }
      />

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">PO #</th>
              <th className="px-4 py-3 font-semibold">Brand</th>
              <th className="px-4 py-3 font-semibold">Style</th>
              <th className="px-4 py-3 font-semibold text-right">Total Qty</th>
              <th className="px-4 py-3 font-semibold text-right">Dispatched</th>
              <th className="px-4 py-3 font-semibold text-right">Remaining</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {ready.map((order) => (
              <tr key={order.id} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{order.poNumber}</td>
                <td className="px-4 py-3">{order.brand}</td>
                <td className="px-4 py-3">{order.styleName}</td>
                <td className="px-4 py-3 text-right font-mono-num">{fmt(order.qty)}</td>
                <td className="px-4 py-3 text-right font-mono-num font-semibold text-success">{fmt(order.dispatched)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-warning">{fmt(order.remaining)}</td>
                <td className="px-4 py-3 font-mono-num text-xs text-muted-foreground">{order.due}</td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3 flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openCreate(order)}>
                    Add Shipment
                  </Button>
                  {order.latestShipment ? (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(order)}>
                      Edit Shipment
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {ready.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No dispatch-ready orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShipmentId ? "Edit Shipment" : "Schedule Dispatch"}</DialogTitle>
            <DialogDescription>
              {target ? `${editingShipmentId ? "Update" : "Create"} shipment for ${target.poNumber}.` : "Create shipment."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => shipmentMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="dispatchDate"
                render={({ field }) => (
                  <Field label="Dispatch Date">
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <Field label="Quantity">
                    <FormControl>
                      <Input type="number" placeholder="1000" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <Field label="Invoice Number">
                    <FormControl>
                      <Input placeholder="INV-2402" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Field label="Shipment Status">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="READY">Ready</SelectItem>
                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                        <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                        {editingShipmentId ? <SelectItem value="CANCELLED">Cancelled</SelectItem> : null}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <PoAttachmentUploader
                value={reportUploads}
                onChange={setReportUploads}
                contexts={["PACKING_REPORT", "DISPATCH_REPORT", "OTHER"]}
                defaultContext="DISPATCH_REPORT"
                sourceType="dispatch_shipment"
                sourceId={editingShipmentId}
                title="Attach packing/dispatch photo"
                compact
              />
              {target?.shipments?.length ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-medium mb-2">Shipment History</div>
                  <div className="space-y-2">
                    {target.shipments.slice(0, 3).map((shipment) => (
                      <div key={shipment.id} className="flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono-num">{shipment.dispatchDate}</div>
                          <div className="text-muted-foreground">{shipment.invoiceNumber || "No invoice"}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono-num">{fmt(shipment.quantity)}</div>
                          <div className="text-muted-foreground">{shipment.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={shipmentMutation.isPending}>
                  {shipmentMutation.isPending ? "Saving..." : editingShipmentId ? "Save Changes" : "Save Shipment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeShipmentStatus(value: string | undefined) {
  switch (value) {
    case "Ready":
      return "READY";
    case "Scheduled":
      return "SCHEDULED";
    case "Dispatched":
      return "DISPATCHED";
    case "Cancelled":
      return "CANCELLED";
    default:
      return "SCHEDULED";
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <FormItem className="space-y-1.5">
      <FormLabel className="text-xs font-medium">{label}</FormLabel>
      {children}
    </FormItem>
  );
}
