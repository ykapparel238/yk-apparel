import { PageHeader } from "@/components/PageHeader";
import { inventory } from "@/lib/mockData";
import { AlertTriangle } from "lucide-react";

export default function Inventory() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const low = inventory.filter((i) => i.stock <= i.min).length;

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
            </tr>
          </thead>
          <tbody>
            {inventory.map((i) => {
              const free = i.stock - i.allocated;
              const lowStock = i.stock <= i.min;
              const healthPct = Math.min(100, Math.round((i.stock / (i.min * 2.5)) * 100));
              return (
                <tr key={i.id} className="data-table-row">
                  <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{i.id}</td>
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{i.type}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold">
                    {fmt(i.stock)} <span className="text-[10px] text-muted-foreground font-normal">{i.uom}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-muted-foreground">{fmt(i.allocated)}</td>
                  <td className={`px-4 py-3 text-right font-mono-num font-semibold ${free < 0 ? "text-destructive" : ""}`}>
                    {fmt(free)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-xs text-muted-foreground">{fmt(i.min)}</td>
                  <td className="px-4 py-3 text-xs">{i.supplier}</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
