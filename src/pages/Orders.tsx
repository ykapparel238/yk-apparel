import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orders } from "@/lib/mockData";
import { Download, Plus, Search } from "lucide-react";
import { useState } from "react";

export default function Orders() {
  const [q, setQ] = useState("");
  const filtered = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(q.toLowerCase()) ||
      o.brand.toLowerCase().includes(q.toLowerCase()) ||
      o.styleName.toLowerCase().includes(q.toLowerCase())
  );
  const fmt = (n: number) => n.toLocaleString("en-IN");

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
            <Button size="sm" className="h-9">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New PO
            </Button>
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
            Showing <span className="font-mono-num font-semibold text-foreground">{filtered.length}</span> of {orders.length}
          </div>
        </div>

        <div className="overflow-x-auto">
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="data-table-row">
                  <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{o.id}</td>
                  <td className="px-4 py-3">{o.brand}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.styleName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono-num">{o.style}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{o.season}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold">{fmt(o.qty)}</td>
                  <td className="px-4 py-3 font-mono-num text-xs text-muted-foreground">{o.due}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${o.status === "Delayed" ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${o.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono-num text-muted-foreground w-9 text-right">
                        {o.progress}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
