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
  Bell,
  Calendar,
  Filter,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/context/RoleContext";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard, fetchMastersOptions, type DashboardFilters } from "@/lib/services";
import { useState } from "react";

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>({});
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => fetchDashboard(filters),
  });
  const optionsQuery = useQuery({
    queryKey: ["masters-options"],
    queryFn: fetchMastersOptions,
  });

  if (dashboardQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load dashboard.</div>;
  }

  const { kpis, dailyTrend, qaDefects, monthlyCapacity, brandSummary, productionStages, alerts, vendors, orders } =
    dashboardQuery.data;
  const query = buildDashboardQuery(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{role} • Overview</div>
          <h1 className="text-2xl font-bold text-foreground mt-1">Production Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live status across brands, vendors, and production pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => {
            const to = new Date();
            const from = new Date();
            from.setDate(to.getDate() - 30);
            setFilters((current) => ({
              ...current,
              dateFrom: from.toISOString().slice(0, 10),
              dateTo: to.toISOString().slice(0, 10),
            }));
          }}>
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            Last 30 days
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => {
            setDraftFilters(filters);
            setFiltersOpen(true);
          }}>
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filters
          </Button>
          <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => {
            window.location.href = `/api/dashboard.pdf${query}`;
          }}>
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Orders" value={kpis.totalOrders} hint="all purchase orders" icon={ShoppingCart} />
        <KpiCard label="Units Planned" value={fmt(kpis.unitsPlanned)} hint="across all seasons" icon={Package} tone="info" />
        <KpiCard label="In Production" value={fmt(kpis.unitsInProduction)} hint="active work in progress" icon={Factory} tone="info" />
        <KpiCard label="Completed" value={fmt(kpis.unitsCompleted)} hint="delivered quantity" icon={CheckCircle2} tone="success" />
        <KpiCard label="Line Efficiency" value={`${kpis.lineEfficiency}%`} hint="weighted avg" icon={Gauge} tone="success" />
        <KpiCard label="OTIF Delivery" value={`${kpis.otif}%`} hint="shipments vs due dates" icon={Truck} tone="warning" />
        <KpiCard label="Rejection %" value={`${kpis.rejectionPct}%`} hint="from production + QA" icon={Percent} tone="success" />
        <KpiCard label="Delayed Orders" value={kpis.delayedOrders} hint="needs escalation" icon={AlertTriangle} tone="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Daily Production Trend</h3>
              <p className="text-xs text-muted-foreground">Planned vs actual output (units)</p>
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

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground">QA Defect Mix</h3>
          <p className="text-xs text-muted-foreground mb-3">Last data window</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={qaDefects} dataKey="count" nameKey="type" innerRadius={45} outerRadius={75} paddingAngle={2}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Monthly Capacity Utilization</h3>
              <p className="text-xs text-muted-foreground">Installed capacity vs output</p>
            </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold">Production Stage Tracker</h3>
            <p className="text-xs text-muted-foreground">Pipeline view across stages</p>
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
                {productionStages.map((stage) => {
                  const pct = stage.planned ? Math.round((stage.actual / stage.planned) * 100) : 0;
                  return (
                    <tr key={stage.stage} className="data-table-row">
                      <td className="px-4 py-2.5 font-medium">{stage.stage}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num text-muted-foreground">{fmt(stage.planned)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num font-semibold">{fmt(stage.actual)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num text-info">{fmt(stage.wip)}</td>
                      <td className="px-4 py-2.5 text-right font-mono-num text-destructive">{fmt(stage.rejected)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
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
              const tone = a.severity === "critical" ? "bg-destructive" : a.severity === "warning" ? "bg-warning" : "bg-info";
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
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-medium">{vendor.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{vendor.process}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{fmt(vendor.pending)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-mono-num font-semibold ${vendor.otd >= 90 ? "text-success" : vendor.otd >= 85 ? "text-warning" : "text-destructive"}`}>
                      {vendor.otd}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-semibold">{vendor.quality}%</td>
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
              {orders.map((order) => (
                <tr key={order.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-mono-num text-xs">{order.id}</td>
                  <td className="px-4 py-2.5">{order.brand}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{fmt(order.qty)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dashboard Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">From</label>
                <Input type="date" value={draftFilters.dateFrom ?? ""} onChange={(event) => setDraftFilters((current) => ({ ...current, dateFrom: event.target.value || undefined }))} />
              </div>
              <div>
                <label className="text-xs font-medium">To</label>
                <Input type="date" value={draftFilters.dateTo ?? ""} onChange={(event) => setDraftFilters((current) => ({ ...current, dateTo: event.target.value || undefined }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Brand</label>
              <Select value={draftFilters.brandId ?? "__all"} onValueChange={(value) => setDraftFilters((current) => ({ ...current, brandId: value === "__all" ? undefined : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All brands</SelectItem>
                  {(optionsQuery.data?.brands ?? []).map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Order Status</label>
              <Select value={draftFilters.status ?? "__all"} onValueChange={(value) => setDraftFilters((current) => ({ ...current, status: value === "__all" ? undefined : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All statuses</SelectItem>
                  <SelectItem value="CREATED">Created</SelectItem>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="IN_PRODUCTION">In Production</SelectItem>
                  <SelectItem value="QA">QA</SelectItem>
                  <SelectItem value="READY_TO_DISPATCH">Ready To Dispatch</SelectItem>
                  <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                  <SelectItem value="DELAYED">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDraftFilters({});
              setFilters({});
              setFiltersOpen(false);
            }}>Clear</Button>
            <Button onClick={() => {
              setFilters(draftFilters);
              setFiltersOpen(false);
            }}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildDashboardQuery(filters: DashboardFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}
