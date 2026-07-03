import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createPlan, fetchPlanningBoard, updatePlan } from "@/lib/services";
import { Calendar, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

const columns = ["Created", "Planned", "In Production", "QA", "Dispatched"] as const;

const planSchema = z.object({
  orderId: z.string().min(1, "Select an order"),
  lineId: z.string().min(1, "Select a line"),
  startDate: z.string().min(1, "Select a start date"),
  endDate: z.string().min(1, "Select an end date"),
  plannedQty: z.coerce.number().int().positive("Enter a valid plan quantity"),
});

type PlanFormInput = z.infer<typeof planSchema>;

const emptyValues: PlanFormInput = {
  orderId: "",
  lineId: "",
  startDate: "",
  endDate: "",
  plannedQty: undefined,
};

export default function Planning() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const routeState = location.state as { openPlanForOrderId?: string } | null;

  const boardQuery = useQuery({
    queryKey: ["planning-board"],
    queryFn: fetchPlanningBoard,
  });

  const form = useForm<PlanFormInput>({
    resolver: zodResolver(planSchema),
    defaultValues: emptyValues,
  });

  const board = boardQuery.data;
  const allocationsByOrder = useMemo(
    () => new Map((board?.allocations ?? []).map((allocation) => [allocation.orderId, allocation])),
    [board?.allocations],
  );

  const selectedOrder = board?.orders.find((order) => order.id === form.watch("orderId"));
  const selectedAllocation = selectedOrder ? allocationsByOrder.get(selectedOrder.id) : undefined;

  const openPlanSheet = useCallback((orderId = "") => {
    setSelectedOrderId(orderId);
    const allocation = orderId ? allocationsByOrder.get(orderId) : undefined;
    const order = board?.orders.find((item) => item.id === orderId);

    form.reset(
      allocation
        ? {
            orderId,
            lineId: allocation.lineId,
            startDate: allocation.startDate,
            endDate: allocation.endDate,
            plannedQty: allocation.plannedQty,
          }
        : {
            orderId,
            lineId: "",
            startDate: "",
            endDate: order?.due ?? "",
            plannedQty: order?.qty,
          },
    );
    setOpen(true);
  }, [allocationsByOrder, board?.orders, form]);

  const closePlanSheet = () => {
    setOpen(false);
    setSelectedOrderId("");
    form.reset(emptyValues);
  };

  useEffect(() => {
    if (!board || !routeState?.openPlanForOrderId) return;
    openPlanSheet(routeState.openPlanForOrderId);
    navigate(location.pathname, { replace: true, state: null });
  }, [board, routeState?.openPlanForOrderId, openPlanSheet, navigate, location.pathname]);

  const planMutation = useMutation({
    mutationFn: async (values: PlanFormInput) => {
      const allocation = allocationsByOrder.get(values.orderId);
      if (allocation) {
        return updatePlan(allocation.id, values);
      }
      return createPlan(values);
    },
    onSuccess: async () => {
      toast.success(selectedAllocation ? "Plan updated" : "Plan created", {
        description: selectedAllocation
          ? "Planning allocation has been updated."
          : "Order has been moved into the planning schedule.",
      });
      closePlanSheet();
      await queryClient.invalidateQueries({ queryKey: ["planning-board"] });
      await queryClient.invalidateQueries({ queryKey: ["planning-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => {
      toast.error("Unable to save plan", {
        description: error instanceof Error ? error.message : "Please review the allocation and try again.",
      });
    },
  });

  if (boardQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading planning board...</div>;
  }

  if (boardQuery.isError || !board) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load planning board.</div>;
  }

  const { lines, orders } = board;

  return (
    <div>
      <PageHeader
        eyebrow="Planner"
        title="Production Planning Board"
        description="Capacity allocation across 7 lines • 200,000 units/month installed"
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/planning/calendar">
                <Calendar className="h-3.5 w-3.5 mr-1.5" /> Production Calendar
              </Link>
            </Button>
            <Sheet open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closePlanSheet())}>
              <SheetTrigger asChild>
                <Button size="sm" className="h-9" onClick={() => openPlanSheet()}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Plan
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{selectedAllocation ? "Update Plan" : "Create Plan"}</SheetTitle>
                  <SheetDescription>
                    Assign an order to a line and lock the working window without changing the current board layout.
                  </SheetDescription>
                </SheetHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((values) => planMutation.mutate(values))}
                    className="space-y-4 mt-6"
                  >
                    <FormField
                      control={form.control}
                      name="orderId"
                      render={({ field }) => (
                        <Field label="Order">
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedOrderId(value);
                              const order = orders.find((item) => item.id === value);
                              const allocation = allocationsByOrder.get(value);
                              if (allocation) {
                                form.setValue("lineId", allocation.lineId);
                                form.setValue("startDate", allocation.startDate);
                                form.setValue("endDate", allocation.endDate);
                                form.setValue("plannedQty", allocation.plannedQty);
                              } else {
                                form.setValue("lineId", "");
                                form.setValue("startDate", "");
                                form.setValue("endDate", order?.due ?? "");
                                form.setValue("plannedQty", order?.qty ?? undefined);
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select order" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {orders.map((order) => (
                                <SelectItem key={order.id} value={order.id}>
                                  {order.poNumber} — {order.styleName}
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
                      name="lineId"
                      render={({ field }) => (
                        <Field label="Line">
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select line" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {lines.map((line) => (
                                <SelectItem key={line.id} value={line.id}>
                                  {line.name} — {line.gauge}
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
                        name="startDate"
                        render={({ field }) => (
                          <Field label="Start Date">
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </Field>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <Field label="End Date">
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
                      name="plannedQty"
                      render={({ field }) => (
                        <Field label="Planned Quantity">
                          <FormControl>
                            <Input type="number" placeholder="15000" {...field} />
                          </FormControl>
                          <FormMessage className="text-[11px]" />
                        </Field>
                      )}
                    />
                    {selectedOrder ? (
                      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        Due {selectedOrder.due} • Current status {selectedOrder.status} • Order qty {fmt(selectedOrder.qty)}
                      </div>
                    ) : null}
                    <SheetFooter className="mt-6">
                      <Button type="button" variant="outline" onClick={closePlanSheet}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={planMutation.isPending}>
                        {planMutation.isPending
                          ? selectedAllocation
                            ? "Saving..."
                            : "Creating..."
                          : selectedAllocation
                            ? "Save Plan"
                            : "Create Plan"}
                      </Button>
                    </SheetFooter>
                  </form>
                </Form>
              </SheetContent>
            </Sheet>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {lines.map((line) => (
          <div key={line.id} className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{line.gauge}</div>
            <div className="font-semibold text-sm mt-0.5">{line.name}</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono-num">{line.efficiency}%</span>
              <span className="text-[11px] text-muted-foreground">eff</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${line.efficiency >= 90 ? "bg-success" : line.efficiency >= 85 ? "bg-warning" : "bg-destructive"}`}
                style={{ width: `${line.efficiency}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
              <span>{line.machines} m/c</span>
              <span className="font-mono-num">{fmt(line.output)} u/d</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {columns.map((column) => {
          const cards = orders.filter((order) => order.status === column);
          return (
            <div key={column} className="bg-muted/30 border border-border rounded-lg flex flex-col min-h-[400px]">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge status={column} />
                  <span className="text-xs font-mono-num text-muted-foreground">{cards.length}</span>
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {cards.map((card) => {
                  const allocation = allocationsByOrder.get(card.id);
                  return (
                    <div
                      key={card.id}
                      onClick={() => navigate(`/orders/${card.id}`)}
                      className="bg-card border border-border rounded-md p-3 hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-mono-num font-semibold text-primary">{card.poNumber}</span>
                        <StatusBadge status={card.priority} />
                      </div>
                      <div className="mt-1.5 text-sm font-medium leading-snug">{card.styleName}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{card.brand} • {card.season}</div>
                      <div className="mt-2.5 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Due {card.due}</span>
                        <span className="font-mono-num font-semibold">{fmt(card.qty)}</span>
                      </div>
                      {allocation ? (
                        <button
                          type="button"
                          className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            openPlanSheet(card.id);
                          }}
                        >
                          {allocation.lineName} • {allocation.startDate} to {allocation.endDate}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 text-[11px] text-primary hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openPlanSheet(card.id);
                          }}
                        >
                          Assign line and schedule
                        </button>
                      )}
                      {card.progress > 0 && (
                        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${card.status === "Delayed" ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${card.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {cards.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">No orders</div>}
              </div>
            </div>
          );
        })}
      </div>
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
