import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { lines, orders } from "@/lib/mockData";
import { Calendar, Plus } from "lucide-react";

const columns = ["Created", "Planned", "In Production", "QA", "Dispatched"] as const;

export default function Planning() {
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div>
      <PageHeader
        eyebrow="Planner"
        title="Production Planning Board"
        description="Capacity allocation across 7 lines • 200,000 units/month installed"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9">
              <Calendar className="h-3.5 w-3.5 mr-1.5" /> Production Calendar
            </Button>
            <Button size="sm" className="h-9">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Plan
            </Button>
          </>
        }
      />

      {/* Line capacity */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {lines.map((l) => (
          <div key={l.id} className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l.gauge}</div>
            <div className="font-semibold text-sm mt-0.5">{l.name}</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono-num">{l.efficiency}%</span>
              <span className="text-[11px] text-muted-foreground">eff</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${l.efficiency >= 90 ? "bg-success" : l.efficiency >= 85 ? "bg-warning" : "bg-destructive"}`}
                style={{ width: `${l.efficiency}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
              <span>{l.machines} m/c</span>
              <span className="font-mono-num">{fmt(l.output)} u/d</span>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {columns.map((col) => {
          const cards = orders.filter((o) => o.status === col);
          return (
            <div key={col} className="bg-muted/30 border border-border rounded-lg flex flex-col min-h-[400px]">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusBadge status={col} />
                  <span className="text-xs font-mono-num text-muted-foreground">
                    {cards.length}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {cards.map((c) => (
                  <div key={c.id} className="bg-card border border-border rounded-md p-3 hover:shadow-sm transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono-num font-semibold text-primary">{c.id}</span>
                      <StatusBadge status={c.priority} />
                    </div>
                    <div className="mt-1.5 text-sm font-medium leading-snug">{c.styleName}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{c.brand} • {c.season}</div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Due {c.due}</span>
                      <span className="font-mono-num font-semibold">{fmt(c.qty)}</span>
                    </div>
                    {c.progress > 0 && (
                      <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${c.status === "Delayed" ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${c.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {cards.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8">No orders</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
