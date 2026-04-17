import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { orders } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Truck, FileText } from "lucide-react";

export default function Dispatch() {
  const ready = orders.filter((o) => ["QA", "Dispatched"].includes(o.status));
  const fmt = (n: number) => n.toLocaleString("en-IN");

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
            <Button size="sm" className="h-9">
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
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {ready.map((o) => (
              <tr key={o.id} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{o.id}</td>
                <td className="px-4 py-3">{o.brand}</td>
                <td className="px-4 py-3">{o.styleName}</td>
                <td className="px-4 py-3 text-right font-mono-num">{fmt(o.qty)}</td>
                <td className="px-4 py-3 text-right font-mono-num font-semibold text-success">{fmt(o.delivered)}</td>
                <td className="px-4 py-3 font-mono-num text-xs text-muted-foreground">{o.due}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm" className="h-7 text-xs">Generate Invoice</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
