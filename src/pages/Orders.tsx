import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  createOrder,
  deleteOrder,
  fetchOrderDetail,
  fetchOrderOptions,
  fetchOrders,
  updateOrder,
} from "@/lib/services";
import type { OrderItem, OrderOption } from "@/lib/types";
import {
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { z } from "zod";

const orderSchema = z.object({
  brandId: z.string().min(1, "Select a brand"),
  styleId: z.string().min(1, "Select a style"),
  poNumber: z.string().min(3, "Enter a PO number"),
  seasonCode: z.string().min(2, "Select a season"),
  quantity: z.coerce.number().int().positive("Enter a valid quantity"),
  dueDate: z.string().min(1, "Select a delivery date"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  notes: z.string().optional(),
  sizeAllocations: z.array(
    z.object({
      sizeLabel: z.string().min(1),
      percent: z.coerce.number().int().min(0).max(100),
    }),
  ).min(1, "Add at least one size allocation"),
  colorAllocations: z.array(
    z.object({
      colorName: z.string().min(1),
      hexCode: z.string().optional().nullable(),
      percent: z.coerce.number().int().min(0).max(100),
    }),
  ).min(1, "Add at least one color allocation"),
}).superRefine((value, ctx) => {
  const sizeTotal = value.sizeAllocations.reduce((sum, item) => sum + item.percent, 0);
  if (sizeTotal !== 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sizeAllocations"],
      message: "Size allocation must total 100%",
    });
  }

  const colorTotal = value.colorAllocations.reduce((sum, item) => sum + item.percent, 0);
  if (colorTotal !== 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["colorAllocations"],
      message: "Color allocation must total 100%",
    });
  }
});

type OrderFormInput = z.infer<typeof orderSchema>;

const emptyFormValues: OrderFormInput = {
  brandId: "",
  styleId: "",
  poNumber: "",
  seasonCode: "",
  quantity: undefined,
  dueDate: "",
  priority: "MEDIUM",
  notes: "",
  sizeAllocations: [],
  colorAllocations: [],
};

function buildPercentDefaults(labels: string[]) {
  if (!labels.length) return [];
  const base = Math.floor(100 / labels.length);
  let remaining = 100;
  return labels.map((label, index) => {
    const percent = index === labels.length - 1 ? remaining : base;
    remaining -= percent;
    return { sizeLabel: label, percent };
  });
}

function buildColorDefaults(colors: Array<{ name: string; hexCode?: string | null }>) {
  if (!colors.length) return [];
  const base = Math.floor(100 / colors.length);
  let remaining = 100;
  return colors.map((color, index) => {
    const percent = index === colors.length - 1 ? remaining : base;
    remaining -= percent;
    return { colorName: color.name, hexCode: color.hexCode, percent };
  });
}

export default function Orders() {
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderItem | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fmt = (n: number) => n.toLocaleString("en-IN");

  const ordersQuery = useQuery({
    queryKey: ["orders", q],
    queryFn: () => fetchOrders({ q }),
  });
  const optionsQuery = useQuery({
    queryKey: ["order-options"],
    queryFn: fetchOrderOptions,
  });
  const editDetailQuery = useQuery({
    queryKey: ["order-detail", editingOrder?.id, "edit"],
    queryFn: () => fetchOrderDetail(editingOrder!.id),
    enabled: Boolean(editingOrder?.id && sheetOpen),
  });

  const form = useForm<OrderFormInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: emptyFormValues,
  });

  const selectedBrandId = form.watch("brandId");
  const watchedStyleId = form.watch("styleId");
  const availableStyles = useMemo(() => {
    if (!optionsQuery.data?.styles) return [];
    if (!selectedBrandId) return optionsQuery.data.styles;
    return optionsQuery.data.styles.filter((style) => style.brandId === selectedBrandId);
  }, [optionsQuery.data?.styles, selectedBrandId]);

  const resetForm = () => {
    form.reset(emptyFormValues);
    setEditingOrder(null);
  };

  const openCreate = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEdit = (order: OrderItem) => {
    setEditingOrder(order);
    form.reset({
      ...emptyFormValues,
      brandId: order.brandId,
      styleId: order.styleId,
      poNumber: order.poNumber,
      seasonCode: order.season,
      quantity: order.qty,
      dueDate: order.due,
      priority: order.priority.toUpperCase() as OrderFormInput["priority"],
    });
    setSheetOpen(true);
  };

  useEffect(() => {
    if (!editingOrder || !editDetailQuery.data) return;
    form.reset({
      brandId: editingOrder.brandId,
      styleId: editingOrder.styleId,
      poNumber: editingOrder.poNumber,
      seasonCode: editingOrder.season,
      quantity: editingOrder.qty,
      dueDate: editingOrder.due,
      priority: editingOrder.priority.toUpperCase() as OrderFormInput["priority"],
      notes: "",
      sizeAllocations: editDetailQuery.data.sizes.map((item) => ({
        sizeLabel: item.size,
        percent: item.qty,
      })),
      colorAllocations: editDetailQuery.data.colors.map((item) => ({
        colorName: item.color,
        hexCode: item.hex ?? null,
        percent: item.qty,
      })),
    });
  }, [editDetailQuery.data, editingOrder, form]);

  useEffect(() => {
    const selectedStyle = optionsQuery.data?.styles.find((style) => style.id === watchedStyleId);
    if (!selectedStyle) return;
    if (!editingOrder) {
      form.setValue("sizeAllocations", buildPercentDefaults(selectedStyle.sizes ?? []), { shouldValidate: true });
      form.setValue("colorAllocations", buildColorDefaults(selectedStyle.colors ?? []), { shouldValidate: true });
    }
  }, [editingOrder, form, optionsQuery.data?.styles, watchedStyleId]);

  const invalidateOrders = async () => {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: OrderFormInput) => {
      if (editingOrder) {
        return updateOrder(editingOrder.id, values);
      }
      return createOrder(values);
    },
    onSuccess: async ({ item }) => {
      toast.success(editingOrder ? "Purchase Order updated" : "Purchase Order created", {
        description: editingOrder
          ? "PO changes have been saved."
          : "New PO has been queued for planning.",
      });
      await invalidateOrders();
      setSheetOpen(false);
      resetForm();
      if (!editingOrder) navigate(`/orders/${item.id}`);
    },
    onError: (error) => {
      toast.error(editingOrder ? "Unable to update purchase order" : "Unable to create purchase order", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: async () => {
      toast.success("Purchase Order deleted", {
        description: "The PO has been removed.",
      });
      setDeleteTarget(null);
      await invalidateOrders();
    },
    onError: (error) => {
      toast.error("Unable to delete purchase order", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const filtered = ordersQuery.data?.items ?? [];
  const isLoading = ordersQuery.isLoading || optionsQuery.isLoading;
  const isError = ordersQuery.isError || optionsQuery.isError;

  return (
    <div>
      <PageHeader
        eyebrow="Merchandising"
        title="Purchase Orders"
        description="Manage POs across all brands, styles and seasons"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Sheet
              open={sheetOpen}
              onOpenChange={(nextOpen) => {
                setSheetOpen(nextOpen);
                if (!nextOpen) resetForm();
              }}
            >
              <SheetTrigger asChild>
                <Button size="sm" className="h-9" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New PO
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{editingOrder ? "Edit Purchase Order" : "Create Purchase Order"}</SheetTitle>
                  <SheetDescription>
                    {editingOrder
                      ? "Update the PO details while keeping the current workflow intact."
                      : "Enter PO details — order will enter the planning queue."}
                  </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
                    className="space-y-4 mt-6"
                  >
                    <FormField
                      control={form.control}
                      name="brandId"
                      render={({ field }) => (
                        <Field label="Brand / Customer">
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              const currentStyle = form.getValues("styleId");
                              if (
                                currentStyle &&
                                !optionsQuery.data?.styles.some(
                                  (style) => style.id === currentStyle && style.brandId === value,
                                )
                              ) {
                                form.setValue("styleId", "");
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select brand" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {optionsQuery.data?.brands.map((brand) => (
                                <SelectItem key={brand.id} value={brand.id}>
                                  {brand.name}
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
                      name="styleId"
                      render={({ field }) => (
                        <Field label="Style">
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              const selectedStyle = optionsQuery.data?.styles.find((style) => style.id === value);
                              if (selectedStyle) {
                                form.setValue("sizeAllocations", buildPercentDefaults(selectedStyle.sizes ?? []), { shouldValidate: true });
                                form.setValue("colorAllocations", buildColorDefaults(selectedStyle.colors ?? []), { shouldValidate: true });
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select style" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableStyles.map((style) => (
                                <SelectItem key={style.id} value={style.id}>
                                  {style.code} — {style.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[11px]" />
                        </Field>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="poNumber"
                        render={({ field }) => (
                          <Field label="PO Number">
                            <FormControl>
                              <Input placeholder="PO-24-1021" {...field} />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </Field>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="seasonCode"
                        render={({ field }) => (
                          <Field label="Season">
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Season" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="AW24">AW24</SelectItem>
                                <SelectItem value="SS25">SS25</SelectItem>
                                <SelectItem value="AW25">AW25</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-[11px]" />
                          </Field>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <Field label="Quantity">
                            <FormControl>
                              <Input type="number" placeholder="15000" {...field} />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </Field>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                          <Field label="Delivery Date">
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </Field>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <Field label="Priority">
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CRITICAL">Critical</SelectItem>
                              <SelectItem value="HIGH">High</SelectItem>
                              <SelectItem value="MEDIUM">Medium</SelectItem>
                              <SelectItem value="LOW">Low</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[11px]" />
                        </Field>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <Field label="Notes">
                          <FormControl>
                            <Input placeholder="Special instructions, ship-mode, etc." {...field} />
                          </FormControl>
                          <FormMessage className="text-[11px]" />
                        </Field>
                      )}
                    />
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="text-xs font-medium mb-2">Size Breakdown (%)</div>
                      <div className="space-y-2">
                        {form.watch("sizeAllocations").map((item, index) => (
                          <div key={item.sizeLabel} className="grid grid-cols-[1fr_96px] gap-2">
                            <Input value={item.sizeLabel} disabled className="h-9 bg-background" />
                            <Input
                              type="number"
                              value={item.percent}
                              onChange={(event) => {
                                form.setValue(`sizeAllocations.${index}.percent`, Number(event.target.value), { shouldValidate: true });
                              }}
                              className="h-9"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Total {form.watch("sizeAllocations").reduce((sum, item) => sum + item.percent, 0)}%
                      </div>
                      {form.formState.errors.sizeAllocations?.message ? (
                        <p className="text-[11px] mt-1 font-medium text-destructive">
                          {form.formState.errors.sizeAllocations.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="text-xs font-medium mb-2">Color Mix (%)</div>
                      <div className="space-y-2">
                        {form.watch("colorAllocations").map((item, index) => (
                          <div key={item.colorName} className="grid grid-cols-[1fr_96px] gap-2">
                            <div className="h-9 rounded-md border border-input bg-background px-3 text-sm flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-sm border border-border shrink-0"
                                style={{ backgroundColor: item.hexCode ?? "#e5e7eb" }}
                              />
                              <span>{item.colorName}</span>
                            </div>
                            <Input
                              type="number"
                              value={item.percent}
                              onChange={(event) => {
                                form.setValue(`colorAllocations.${index}.percent`, Number(event.target.value), { shouldValidate: true });
                              }}
                              className="h-9"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Total {form.watch("colorAllocations").reduce((sum, item) => sum + item.percent, 0)}%
                      </div>
                      {form.formState.errors.colorAllocations?.message ? (
                        <p className="text-[11px] mt-1 font-medium text-destructive">
                          {form.formState.errors.colorAllocations.message}
                        </p>
                      ) : null}
                    </div>
                    <SheetFooter className="mt-6">
                      <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending
                          ? editingOrder
                            ? "Saving..."
                            : "Creating..."
                          : editingOrder
                            ? "Save Changes"
                            : "Create PO"}
                      </Button>
                    </SheetFooter>
                  </form>
                </Form>
              </SheetContent>
            </Sheet>
          </>
        }
      />

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search PO, brand, style…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Showing <span className="font-mono-num font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading purchase orders...</div>
          ) : isError ? (
            <div className="p-8 text-center text-sm text-destructive">Unable to load purchase orders.</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No purchase orders found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">PO #</th>
                  <th className="px-4 py-3 font-semibold">Brand</th>
                  <th className="px-4 py-3 font-semibold">Style</th>
                  <th className="px-4 py-3 font-semibold">Season</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold">Due Date</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold w-32">Progress</th>
                  <th className="px-3 py-3 font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="data-table-row cursor-pointer"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{order.poNumber}</td>
                    <td className="px-4 py-3">{order.brand}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.styleName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono-num">{order.style}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{order.season}</td>
                    <td className="px-4 py-3 text-right font-mono-num font-semibold">{fmt(order.qty)}</td>
                    <td className="px-4 py-3 font-mono-num text-xs text-muted-foreground">{order.due}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${order.status === "Delayed" ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${order.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono-num text-muted-foreground w-9 text-right">
                          {order.progress}%
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(order)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(order)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Purchase Order</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete ${deleteTarget.poNumber}? This can only be done before execution records exist.`
                : "Delete this purchase order?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteTarget || deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete PO"}
            </Button>
          </DialogFooter>
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
