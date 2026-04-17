import { PageHeader } from "@/components/PageHeader";
import { productionStages, lines } from "@/lib/mockData";

export default function Production() {
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div>
      <PageHeader
        eyebrow="Floor"
        title="Production Floor — Live"
        description="Stage-by-stage tracking from yarn inward to dispatch"
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
    </div>
  );
}
