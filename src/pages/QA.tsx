import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { qaDefects, vendors } from "@/lib/mockData";
import { ShieldCheck, AlertOctagon, RotateCcw, CheckCircle2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function QA() {
  return (
    <div>
      <PageHeader
        eyebrow="Quality"
        title="Quality Assurance"
        description="Inline & endline checks, rejection trends, root cause analysis"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Pieces Checked" value="102,400" icon={ShieldCheck} delta={5} tone="info" />
        <KpiCard label="Approved" value="99,946" icon={CheckCircle2} delta={6} tone="success" />
        <KpiCard label="Rejected" value="2,454" icon={AlertOctagon} delta={-12} tone="destructive" />
        <KpiCard label="Rework" value="1,108" icon={RotateCcw} delta={-3} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Defects by Type</h3>
          <p className="text-xs text-muted-foreground mb-4">Pareto — last 30 days</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={qaDefects} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={11} width={130} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="hsl(var(--chart-6))" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold">Vendor-wise Quality Trend</h3>
            <p className="text-xs text-muted-foreground">Pass rate by subcontractor</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Vendor</th>
                <th className="px-4 py-3 font-semibold">Process</th>
                <th className="px-4 py-3 font-semibold w-48">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="data-table-row">
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{v.process}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${v.quality >= 95 ? "bg-success" : "bg-warning"}`} style={{ width: `${v.quality}%` }} />
                      </div>
                      <span className="text-[11px] font-mono-num font-semibold w-9 text-right">{v.quality}%</span>
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
