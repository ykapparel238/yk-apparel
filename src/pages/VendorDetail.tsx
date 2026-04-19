import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
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
import { fetchVendorDetail, issueVendorChallan, updateVendorChallan } from "@/lib/services";
import type { VendorDetailPayload } from "@/lib/types";
import { ArrowLeft, FileText, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { z } from "zod";

const challanSchema = z.object({
  orderId: z.string().min(1, "Select a PO"),
  challanDate: z.string().min(1, "Select a challan date"),
  outwardQty: z.coerce.number().int().positive("Enter a valid outward quantity"),
});

type ChallanInput = z.infer<typeof challanSchema>;
const challanUpdateSchema = z.object({
  inwardQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
});
type ChallanUpdateInput = z.infer<typeof challanUpdateSchema>;

export default function VendorDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VendorDetailPayload["challans"][number] | null>(null);
  const fmt = (n: number) => n.toLocaleString("en-IN");

  const vendorQuery = useQuery({
    queryKey: ["vendor-detail", id],
    queryFn: () => fetchVendorDetail(id!),
    enabled: Boolean(id),
  });

  const form = useForm<ChallanInput>({
    resolver: zodResolver(challanSchema),
    defaultValues: {
      orderId: "",
      challanDate: "",
      outwardQty: undefined,
    },
  });
  const updateForm = useForm<ChallanUpdateInput>({
    resolver: zodResolver(challanUpdateSchema),
    defaultValues: { inwardQty: 0, rejectedQty: 0 },
  });

  const challanMutation = useMutation({
    mutationFn: (values: ChallanInput) => issueVendorChallan(id!, values),
    onSuccess: async () => {
      toast.success("Challan issued", {
        description: "Vendor challan has been created.",
      });
      setDialogOpen(false);
      form.reset({ orderId: "", challanDate: "", outwardQty: undefined });
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
    onError: (error) => {
      toast.error("Unable to issue challan", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (values: ChallanUpdateInput) => updateVendorChallan(id!, editTarget!.id, values),
    onSuccess: async () => {
      toast.success("Challan updated", {
        description: "Inward and rejection values have been saved.",
      });
      setEditTarget(null);
      updateForm.reset({ inwardQty: 0, rejectedQty: 0 });
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
    onError: (error) => {
      toast.error("Unable to update challan", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (vendorQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading vendor details...</div>;
  }

  if (vendorQuery.isError || !vendorQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load vendor details.</div>;
  }

  const vendor = vendorQuery.data.item;
  const vendorChallans = vendorQuery.data.challans;
  const trend = vendorQuery.data.trend;
  const scorecard = vendorQuery.data.scorecard;
  const utilisation = vendorQuery.data.utilisation;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/vendors"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Vendors
        </Link>
      </div>

      <PageHeader
        eyebrow={`Subcontractor • ${vendor.process}`}
        title={vendor.name}
        description={`Vendor ID ${vendor.code} • Daily capacity ${fmt(vendor.capacity)} pcs`}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Scorecard PDF
            </Button>
            <Button size="sm" className="h-9" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Issue Challan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card label="OTD" value={`${vendor.otd}%`} tone={vendor.otd >= 90 ? "success" : "warning"} />
        <Card label="Quality" value={`${vendor.quality}%`} tone={vendor.quality >= 95 ? "success" : "warning"} />
        <Card label="Pending Qty" value={fmt(vendor.pending)} />
        <Card label="Utilisation" value={`${utilisation}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">6-Week Performance Trend</h3>
          <p className="text-xs text-muted-foreground mb-4">OTD% and weekly throughput</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="wk" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                  borderRadius: 8,
                }}
              />
              <Line yAxisId="left" type="monotone" dataKey="otd" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="qty" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Scorecard</h3>
          <div className="space-y-3.5">
            {scorecard.map((row) => (
              <div key={row.k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{row.k}</span>
                  <span className="font-mono-num font-semibold">{row.v}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      row.v >= 92 ? "bg-success" : row.v >= 85 ? "bg-warning" : "bg-destructive"
                    }`}
                    style={{ width: `${row.v}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Challan History</h3>
          <p className="text-xs text-muted-foreground">All job-work in/out for {vendor.name}</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Challan</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">PO</th>
              <th className="px-4 py-3 font-semibold text-right">Out</th>
              <th className="px-4 py-3 font-semibold text-right">In</th>
              <th className="px-4 py-3 font-semibold text-right">Rejected</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {vendorChallans.map((challan) => (
              <tr key={challan.id} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{challan.challanNumber}</td>
                <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">{challan.date}</td>
                <td className="px-4 py-3 font-mono-num text-xs">{challan.po}</td>
                <td className="px-4 py-3 text-right font-mono-num">{fmt(challan.outQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-success">{fmt(challan.inQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-destructive">{fmt(challan.rejected)}</td>
                <td className="px-4 py-3"><StatusBadge status={challan.status} /></td>
                <td className="px-2 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditTarget(challan);
                      updateForm.reset({ inwardQty: challan.inQty, rejectedQty: challan.rejected });
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {vendorChallans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No challans recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Challan</DialogTitle>
            <DialogDescription>Create a new job-work challan for {vendor.name}.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => challanMutation.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="orderId"
                render={({ field }) => (
                  <Field label="Purchase Order">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select PO" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendorQuery.data?.orderOptions.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.poNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <FormField
                control={form.control}
                name="challanDate"
                render={({ field }) => (
                  <Field label="Challan Date">
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <FormField
                control={form.control}
                name="outwardQty"
                render={({ field }) => (
                  <Field label="Outward Quantity">
                    <FormControl>
                      <Input type="number" placeholder="5000" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={challanMutation.isPending}>
                  {challanMutation.isPending ? "Issuing..." : "Issue Challan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Challan</DialogTitle>
            <DialogDescription>
              {editTarget ? `Update inward and rejected quantity for ${editTarget.challanNumber}.` : "Update challan."}
            </DialogDescription>
          </DialogHeader>
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit((values) => updateMutation.mutate(values))} className="space-y-4">
              <FormField
                control={updateForm.control}
                name="inwardQty"
                render={({ field }) => (
                  <Field label="Inward Quantity">
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <FormField
                control={updateForm.control}
                name="rejectedQty"
                render={({ field }) => (
                  <Field label="Rejected Quantity">
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage className="text-[11px]" />
                  </Field>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Update"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`mt-1 text-2xl font-bold font-mono-num ${color}`}>{value}</div>
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
