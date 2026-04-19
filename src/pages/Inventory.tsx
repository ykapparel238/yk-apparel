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
import { createInventoryAdjustment, fetchInventory } from "@/lib/services";
import type { InventoryItem } from "@/lib/types";
import { useForm } from "react-hook-form";
import { AlertTriangle, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const adjustmentSchema = z.object({
  deltaQty: z.coerce.number().refine((value) => value !== 0, "Adjustment cannot be zero"),
  reason: z.string().min(2, "Enter a reason"),
});

type AdjustmentInput = z.infer<typeof adjustmentSchema>;

export default function Inventory() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<InventoryItem | null>(null);
  const inventoryQuery = useQuery({
    queryKey: ["inventory"],
    queryFn: fetchInventory,
  });

  const form = useForm<AdjustmentInput>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { deltaQty: undefined, reason: "" },
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

  if (inventoryQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading inventory...</div>;
  }

  if (inventoryQuery.isError || !inventoryQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load inventory.</div>;
  }

  const inventory = inventoryQuery.data.items;
  const low = inventoryQuery.data.lowStockCount;

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
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold w-40">Stock Health</th>
              <th className="px-4 py-3 font-semibold w-12"></th>
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
                  <td className="px-2 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTarget(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
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
    </div>
  );
}
