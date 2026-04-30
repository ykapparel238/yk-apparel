import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { fetchOrderDetail, fetchProductionStages } from "@/lib/services";
import { ArrowLeft, Download, FileText, Pencil, Printer, Trash2 } from "lucide-react";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const orderQuery = useQuery({
    queryKey: ["order-detail", id],
    queryFn: () => fetchOrderDetail(id!),
    enabled: Boolean(id),
  });
  const productionStagesQuery = useQuery({
    queryKey: ["production-stages"],
    queryFn: fetchProductionStages,
  });

  if (orderQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading order details...</div>;
  }

  if (orderQuery.isError || !orderQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load order details.</div>;
  }

  const order = orderQuery.data.item;
  const sizes = orderQuery.data.sizes;
  const colorBreakdown = orderQuery.data.colors;
  const bom = orderQuery.data.bom;
  const orderChallans = orderQuery.data.challans;
  const productionStages = productionStagesQuery.data?.items ?? [];

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Orders
        </Link>
      </div>

      <PageHeader
        eyebrow={`${order.brand} • ${order.season}`}
        title={`${order.poNumber} — ${order.styleName}`}
        description={`Style ${order.style} • Due ${order.due}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => navigate("/orders", { state: { openOrderAction: "edit", orderId: order.id } })}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => navigate("/orders", { state: { openOrderAction: "delete", orderId: order.id } })}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Order
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Tech Pack
            </Button>
            <Button size="sm" className="h-9">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Issue Challan
            </Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Order Qty" value={fmt(order.qty)} />
        <Stat label="Delivered" value={fmt(order.delivered)} tone="success" />
        <Stat
          label="In Pipeline"
          value={fmt(Math.max(0, order.qty - order.delivered))}
          tone="info"
        />
        <Stat label="Progress" value={`${order.progress}%`} />
        <Stat
          label="Status"
          custom={
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.priority} />
            </div>
          }
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Size breakdown */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Size Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">% of order qty</p>
          <div className="space-y-2.5">
            {sizes.map((s) => {
              const qty = Math.round((order.qty * s.qty) / 100);
              return (
                <div key={s.size}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{s.size}</span>
                    <span className="font-mono-num text-muted-foreground">
                      {fmt(qty)}{" "}
                      <span className="text-[10px]">({s.qty}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${s.qty * 3}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Color breakdown */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Color Mix</h3>
          <p className="text-xs text-muted-foreground mb-4">Allocation by colourway</p>
          <div className="space-y-3">
            {colorBreakdown.map((c) => {
              const qty = Math.round((order.qty * c.qty) / 100);
              return (
                <div key={c.color} className="flex items-center gap-3">
                  <span
                    className="h-7 w-7 rounded-md border border-border shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{c.color}</span>
                      <span className="font-mono-num text-muted-foreground">
                        {fmt(qty)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full bg-chart-2 rounded-full"
                        style={{ width: `${c.qty * 3}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage timeline */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Stage Timeline</h3>
          <p className="text-xs text-muted-foreground mb-4">Order progression</p>
          <ol className="relative border-l border-border ml-1.5 space-y-3">
            {productionStages.slice(0, 8).map((s, i) => {
              const done = i < Math.floor(order.progress / 12);
              return (
                <li key={s.stage} className="ml-4">
                  <span
                    className={`absolute -left-[5px] flex h-2.5 w-2.5 rounded-full ${
                      done ? "bg-success" : "bg-muted border border-border"
                    }`}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={
                        done ? "font-medium" : "text-muted-foreground"
                      }
                    >
                      {s.stage}
                    </span>
                    {done && (
                      <span className="text-[10px] text-success font-mono-num">
                        ✓ done
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* BOM */}
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Bill of Materials</h3>
          <p className="text-xs text-muted-foreground">Per piece consumption</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold text-right">Per Pc</th>
              <th className="px-4 py-3 font-semibold text-right">Total Req.</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((b) => (
              <tr key={b.id} className="data-table-row">
                <td className="px-4 py-3 font-medium">{b.item}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{b.type}</td>
                <td className="px-4 py-3 text-right font-mono-num">
                  {b.qty}{" "}
                  <span className="text-[10px] text-muted-foreground">{b.uom}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono-num font-semibold">
                  {fmt(Math.round(b.qty * order.qty * 100) / 100)}{" "}
                  <span className="text-[10px] text-muted-foreground">{b.uom}</span>
                </td>
                <td className="px-4 py-3 text-xs">{b.supplier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendor challans for this PO */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Vendor Job-Work Challans</h3>
          <p className="text-xs text-muted-foreground">
            {orderChallans.length} challans linked to this order
          </p>
        </div>
        {orderChallans.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No challans issued yet for this PO.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Challan #</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Vendor</th>
                <th className="px-4 py-3 font-semibold">Process</th>
                <th className="px-4 py-3 font-semibold text-right">Out</th>
                <th className="px-4 py-3 font-semibold text-right">In</th>
                <th className="px-4 py-3 font-semibold text-right">Rejected</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orderChallans.map((c) => (
                <tr key={c.id} className="data-table-row">
                  <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">
                    {c.challanNumber}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">
                    {c.date}
                  </td>
                  <td className="px-4 py-3">{c.vendor}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.process}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmt(c.outQty)}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-success">
                    {fmt(c.inQty)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-destructive">
                    {fmt(c.rejected)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  custom,
}: {
  label: string;
  value?: string;
  tone?: "success" | "info";
  custom?: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "info"
      ? "text-info"
      : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      {custom ?? (
        <div className={`mt-1 text-xl font-bold font-mono-num ${color}`}>
          {value}
        </div>
      )}
    </div>
  );
}
