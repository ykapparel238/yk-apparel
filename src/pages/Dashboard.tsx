import { KpiCard } from "@/components/KpiCard";
import {
  ShoppingCart,
  Factory,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Truck,
  Percent,
  Package,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  alerts,
  brandSummary,
  dailyTrend,
  kpis,
  monthlyCapacity,
  orders,
  productionStages,
  qaDefects,
  vendors,
} from "@/lib/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { Bell, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/context/RoleContext";

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    boxShadow: "var(--shadow-md)",
  },
  labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600 },
};

export default function Dashboard() {
  const { role } = useRole();
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {role} • Overview
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            Production Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live status across 7 brands, 6 vendors and 982,400 units in pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Last 30 days
          </Button>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filters
          </Button>
          <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90">
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Orders" value={kpis.totalOrders} hint="12 active POs" icon={ShoppingCart} delta={8} />
        <KpiCard label="Units Planned" value={fmt(kpis.unitsPlanned)} hint="across all seasons" icon={Package} delta={4} tone="info" />
        <KpiCard label="In Production" value={fmt(kpis.unitsInProduction)} hint="WIP across 7 lines" icon={Factory} delta={6} tone="info" />
        <KpiCard label="Completed" value={fmt(kpis.unitsCompleted)} hint="dispatched + ready" icon={CheckCircle2} delta={11} tone="success" />
        <KpiCard label="Line Efficiency" value={`${kpis.lineEfficiency}%`} hint="weighted avg" icon={Gauge} delta={2} tone="success" />
        <KpiCard label="OTIF Delivery" value={`${kpis.otif}%`} hint="last 90 days" icon={Truck} delta={-1} tone="warning" />
        <KpiCard label="Rejection %" value={`${kpis.rejectionPct}%`} hint="industry avg 3.2%" icon={Percent} delta={-0.4} tone="success" />
        <KpiCard label="Delayed Orders" value={kpis.delayedOrders} hint="needs escalation" icon={AlertTriangle} delta={1} tone="destructive" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily production */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Daily Production Trend</h3>
              <p className="text-xs text-muted-foreground">Planned vs actual output (units)</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-1" />Planned</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-3" />Actual</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-chart-6" />Rejected</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="planned" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="rejected" fill="hsl(var(--chart-6))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* QA defect mix */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground">QA Defect Mix</h3>
          <p className="text-xs text-muted-foreground mb-3">Last 30 days — 1,106 issues</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={qaDefects}
                dataKey="count"
                nameKey="type"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {qaDefects.map((_, i) => (
                  <Cell key={i} fill={`hsl(var(--chart-${(i % 6) + 1}))`} />
                ))}
              </Pie>
              <Tooltip {...chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {qaDefects.slice(0, 4).map((d, i) => (
              <div key={d.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: `hsl(var(--chart-${(i % 6) + 1}))` }} />
                  <span className="text-muted-foreground">{d.type}</span>
                </div>
                <span className="font-mono-num font-medium">{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Capacity + Brand */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Monthly Capacity Utilization</h3>
              <p className="text-xs text-muted-foreground">200,000 unit/month installed capacity</p>
            </div>
            <span className="text-xs font-mono-num text-success bg-success-soft px-2 py-1 rounded">
              92% avg
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyCapacity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip {...chartTooltipStyle} />
              <Line type="monotone" dataKey="capacity" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="used" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Brand-wise Volume</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={brandSummary} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis type="category" dataKey="brand" stroke="hsl(var(--muted-foreground))" fontSize={10} width={90} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="units" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stage tracker + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold">Production Stage Tracker</h3>
            <p className="text-xs text-muted-foreground">Pipeline view across 10 stages</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Stage</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Planned</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actual</th>
                  <th className="px-4 py-2.5 font-semibold text-right">WIP</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Rejected</th>
                  <th className="px-4 py-2.5 font-semibold w-32">Progress</th>
                </tr>
              </thead>
              <tbody>
                {productionStages.map((s) => {
                  const pct = Math.round((s.actual / s.planned) * 100);
                  return (
                    <tr key={s.stage} className="data-table-row">
                      <td className="px-4 py-2.5 font-medium">{s.stage}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num text-muted-foreground">{fmt(s.planned)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num font-semibold">{fmt(s.actual)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num text-info">{fmt(s.wip)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num text-destructive">{fmt(s.rejected)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono-num text-muted-foreground w-9 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Live Alerts</h3>
              <p className="text-xs text-muted-foreground">{alerts.length} active</p>
            </div>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border max-h-[440px] overflow-y-auto">
            {alerts.map((a) => {
              const tone =
                a.severity === "critical"
                  ? "bg-destructive"
                  : a.severity === "warning"
                  ? "bg-warning"
                  : "bg-info";
              return (
                <div key={a.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${tone}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground leading-snug">{a.title}</div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="px-1.5 py-0.5 bg-muted rounded">{a.module}</span>
                        <span>{a.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vendor + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold">Vendor Performance</h3>
            <p className="text-xs text-muted-foreground">OTD = on-time delivery</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-semibold">Vendor</th>
                <th className="px-4 py-2.5 font-semibold">Process</th>
                <th className="px-4 py-2.5 font-semibold text-right">Pending</th>
                <th className="px-4 py-2.5 font-semibold text-right">OTD</th>
                <th className="px-4 py-2.5 font-semibold text-right">Quality</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-medium">{v.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{v.process}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{fmt(v.pending)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-mono-num font-semibold ${v.otd >= 90 ? "text-success" : v.otd >= 85 ? "text-warning" : "text-destructive"}`}>
                      {v.otd}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-semibold">{v.quality}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold">Recent Orders</h3>
            <p className="text-xs text-muted-foreground">Updated just now</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-semibold">PO</th>
                <th className="px-4 py-2.5 font-semibold">Brand</th>
                <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 7).map((o) => (
                <tr key={o.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-mono-num text-xs">{o.id}</td>
                  <td className="px-4 py-2.5">{o.brand}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{fmt(o.qty)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
