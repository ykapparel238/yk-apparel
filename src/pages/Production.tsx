import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProductionEntry, fetchProductionEntries, fetchProductionLines, fetchProductionStages, updateProductionEntry } from "@/lib/services";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const entrySchema = z.object({
  metricDate: z.string().min(1),
  lineId: z.string().min(1),
  orderId: z.string().optional(),
  shiftId: z.string().optional(),
  stage: z.string().min(1),
  plannedQty: z.coerce.number().int().min(0),
  actualQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
  downtimeMinutes: z.coerce.number().int().min(0),
  downtimeReasonId: z.string().optional(),
  remarks: z.string().optional(),
});

type EntryInput = z.infer<typeof entrySchema>;

export default function Production() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const stagesQuery = useQuery({
    queryKey: ["production-stages"],
    queryFn: fetchProductionStages,
  });
  const linesQuery = useQuery({
    queryKey: ["production-lines"],
    queryFn: fetchProductionLines,
  });
  const entriesQuery = useQuery({
    queryKey: ["production-entries"],
    queryFn: fetchProductionEntries,
  });
  const form = useForm<EntryInput>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      metricDate: "",
      lineId: "",
      orderId: "",
      shiftId: "",
      stage: "KNITTING",
      plannedQty: 0,
      actualQty: 0,
      rejectedQty: 0,
      downtimeMinutes: 0,
      downtimeReasonId: "",
      remarks: "",
    },
  });
  const entryMutation = useMutation({
    mutationFn: (values: EntryInput) => {
      const payload = {
        ...values,
        orderId: values.orderId || null,
        shiftId: values.shiftId || null,
        downtimeReasonId: values.downtimeReasonId || null,
        remarks: values.remarks || null,
      };
      if (editingId) return updateProductionEntry(editingId, payload);
      return createProductionEntry(payload);
    },
    onSuccess: async () => {
      toast.success(editingId ? "Production entry updated" : "Production entry created");
      setOpen(false);
      setEditingId(null);
      form.reset({
        metricDate: "",
        lineId: "",
        orderId: "",
        shiftId: "",
        stage: "KNITTING",
        plannedQty: 0,
        actualQty: 0,
        rejectedQty: 0,
        downtimeMinutes: 0,
        downtimeReasonId: "",
        remarks: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["production-stages"] });
      await queryClient.invalidateQueries({ queryKey: ["production-lines"] });
      await queryClient.invalidateQueries({ queryKey: ["production-entries"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => {
      toast.error("Unable to save production entry", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (stagesQuery.isLoading || linesQuery.isLoading || entriesQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading production floor...</div>;
  }

  if (stagesQuery.isError || linesQuery.isError || entriesQuery.isError || !stagesQuery.data || !linesQuery.data || !entriesQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load production floor.</div>;
  }

  const productionStages = stagesQuery.data.items;
  const lines = linesQuery.data.items;
  const entries = entriesQuery.data.items;
  const downtimeReasons = entriesQuery.data.downtimeReasons;
  const shifts = entriesQuery.data.shifts;
  const orderOptions = entriesQuery.data.orders;
  const lineOptions = entriesQuery.data.lines;

  const openCreate = () => {
    setEditingId(null);
    form.reset({
      metricDate: new Date().toISOString().slice(0, 10),
      lineId: lineOptions[0]?.id ?? "",
      orderId: "",
      shiftId: shifts[0]?.id ?? "",
      stage: "KNITTING",
      plannedQty: 0,
      actualQty: 0,
      rejectedQty: 0,
      downtimeMinutes: 0,
      downtimeReasonId: "",
      remarks: "",
    });
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Floor"
        title="Production Floor — Live"
        description="Stage-by-stage tracking from yarn inward to dispatch"
        actions={
          <Button size="sm" className="h-9" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Actual Entry
          </Button>
        }
      />

      {/* Pipeline */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold mb-4">Process Pipeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {productionStages.map((s, i) => {
            const pct = Math.round((s.actual / s.planned) * 100);
            return (
              <div key={s.stage} className="flex items-center gap-2 shrink-0">
                <div className="bg-muted/40 border border-border rounded-md p-3 min-w-[140px]">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Stage {i + 1}</div>
                  <div className="text-sm font-semibold mt-0.5">{s.stage}</div>
                  <div className="mt-2 text-lg font-bold font-mono-num">{fmt(s.actual)}</div>
                  <div className="text-[11px] text-muted-foreground">of {fmt(s.planned)}</div>
                  <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {i < productionStages.length - 1 && (
                  <div className="text-muted-foreground text-xs">→</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lines table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Active Lines</h3>
          <p className="text-xs text-muted-foreground">Real-time efficiency and output</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Line</th>
              <th className="px-4 py-3 font-semibold">Gauge</th>
              <th className="px-4 py-3 font-semibold text-right">Machines</th>
              <th className="px-4 py-3 font-semibold text-right">Output (u/day)</th>
              <th className="px-4 py-3 font-semibold w-48">Efficiency</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="data-table-row">
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.gauge}</td>
                <td className="px-4 py-3 text-right font-mono-num">{l.machines}</td>
                <td className="px-4 py-3 text-right font-mono-num font-semibold">{fmt(l.output)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${l.efficiency >= 90 ? "bg-success" : l.efficiency >= 85 ? "bg-warning" : "bg-destructive"}`}
                        style={{ width: `${l.efficiency}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono-num font-semibold w-10 text-right">{l.efficiency}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Running
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden mt-6">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Recent Production Entries</h3>
          <p className="text-xs text-muted-foreground">Shift-level actuals, rejection, and downtime reasons</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Line</th>
              <th className="px-4 py-3 font-semibold">PO</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold text-right">Plan</th>
              <th className="px-4 py-3 font-semibold text-right">Actual</th>
              <th className="px-4 py-3 font-semibold text-right">Reject</th>
              <th className="px-4 py-3 font-semibold text-right">DT (min)</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 12).map((entry) => (
              <tr key={entry.id} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs text-muted-foreground">{entry.metricDate}</td>
                <td className="px-4 py-3 text-xs">{entry.lineName}</td>
                <td className="px-4 py-3 font-mono-num text-xs">{entry.poNumber ?? "Unlinked"}</td>
                <td className="px-4 py-3 text-xs">{entry.stage.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-right font-mono-num">{fmt(entry.plannedQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-success">{fmt(entry.actualQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-destructive">{fmt(entry.rejectedQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-warning">{fmt(entry.downtimeMinutes)}</td>
                <td className="px-4 py-3 text-xs">{entry.downtimeReason ?? "None"}</td>
                <td className="px-2 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingId(entry.id);
                      form.reset({
                        metricDate: entry.metricDate,
                        lineId: entry.lineId,
                        orderId: entry.orderId ?? "",
                        shiftId: entry.shiftId ?? "",
                        stage: entry.stage,
                        plannedQty: entry.plannedQty,
                        actualQty: entry.actualQty,
                        rejectedQty: entry.rejectedQty,
                        downtimeMinutes: entry.downtimeMinutes,
                        downtimeReasonId: entry.downtimeReasonId ?? "",
                        remarks: entry.remarks ?? "",
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {!entries.length ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No production entries recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? setOpen(false) : setOpen(true))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Production Entry" : "Add Production Entry"}</DialogTitle>
            <DialogDescription>Capture planned vs actual output, rejection, downtime, and shift context.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => entryMutation.mutate(values))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="metricDate" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{["YARN_INWARD","KNITTING","LINKING","WASHING","DRYING","FINISHING","IRONING","QUALITY_CHECK","PACKING","DISPATCH"].map((stage) => <SelectItem key={stage} value={stage}>{stage.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="lineId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Line</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{lineOptions.map((line) => <SelectItem key={line.id} value={line.id}>{line.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="orderId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Unlinked</SelectItem>
                        {orderOptions.map((order) => <SelectItem key={order.id} value={order.id}>{order.poNumber}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shiftId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {shifts.map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <FormField control={form.control} name="plannedQty" render={({ field }) => (
                  <FormItem><FormLabel>Plan</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="actualQty" render={({ field }) => (
                  <FormItem><FormLabel>Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rejectedQty" render={({ field }) => (
                  <FormItem><FormLabel>Rejected</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="downtimeMinutes" render={({ field }) => (
                  <FormItem><FormLabel>DT (min)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="downtimeReasonId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Downtime Reason</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {downtimeReasons.map((reason) => <SelectItem key={reason.id} value={reason.id}>{reason.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="remarks" render={({ field }) => (
                  <FormItem><FormLabel>Remarks</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={entryMutation.isPending}>{entryMutation.isPending ? "Saving..." : "Save Entry"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
