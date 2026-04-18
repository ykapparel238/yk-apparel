import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { challans, vendors } from "@/lib/mockData";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const trend = [
  { wk: "W1", otd: 88, qty: 4200 },
  { wk: "W2", otd: 91, qty: 4600 },
  { wk: "W3", otd: 87, qty: 4100 },
  { wk: "W4", otd: 92, qty: 5200 },
  { wk: "W5", otd: 94, qty: 5400 },
  { wk: "W6", otd: 90, qty: 4800 },
];

export default function VendorDetail() {
  const { id } = useParams();
  const vendor = vendors.find((v) => v.id === id) ?? vendors[0];
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const vendorChallans = challans.filter((c) => c.vendor === vendor.name);
  const utilisation = Math.round((vendor.pending / vendor.capacity) * 100);

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/vendors"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Vendors
        </Link>
      </div>

      <PageHeader
        eyebrow={`Subcontractor • ${vendor.process}`}
        title={vendor.name}
        description={`Vendor ID ${vendor.id} • Daily capacity ${fmt(vendor.capacity)} pcs`}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Scorecard PDF
            </Button>
            <Button size="sm" className="h-9">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Issue Challan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card label="OTD" value={`${vendor.otd}%`} tone={vendor.otd >= 90 ? "success" : "warning"} />
        <Card label="Quality" value={`${vendor.quality}%`} tone={vendor.quality >= 95 ? "success" : "warning"} />
        <Card label="Pending Qty" value={fmt(vendor.pending)} />
        <Card label="Utilisation" value={`${utilisation}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">6-Week Performance Trend</h3>
          <p className="text-xs text-muted-foreground mb-4">OTD% and weekly throughput</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="wk" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                  borderRadius: 8,
                }}
              />
              <Line yAxisId="left" type="monotone" dataKey="otd" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="qty" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Scorecard</h3>
          <div className="space-y-3.5">
            {[
              { k: "On-Time Delivery", v: vendor.otd },
              { k: "Quality Pass Rate", v: vendor.quality },
              { k: "Capacity Utilisation", v: utilisation },
              { k: "Communication", v: 88 },
              { k: "Documentation", v: 92 },
            ].map((row) => (
              <div key={row.k}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{row.k}</span>
                  <span className="font-mono-num font-semibold">{row.v}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      row.v >= 92 ? "bg-success" : row.v >= 85 ? "bg-warning" : "bg-destructive"
                    }`}
                    style={{ width: `${row.v}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Challan History</h3>
          <p className="text-xs text-muted-foreground">All job-work in/out for {vendor.name}</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Challan</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">PO</th>
              <th className="px-4 py-3 font-semibold text-right">Out</th>
              <th className="px-4 py-3 font-semibold text-right">In</th>
              <th className="px-4 py-3 font-semibold text-right">Rejected</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {vendorChallans.map((c) => (
              <tr key={c.id} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{c.id}</td>
                <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">{c.date}</td>
                <td className="px-4 py-3 font-mono-num text-xs">{c.po}</td>
                <td className="px-4 py-3 text-right font-mono-num">{fmt(c.outQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-success">{fmt(c.inQty)}</td>
                <td className="px-4 py-3 text-right font-mono-num text-destructive">{fmt(c.rejected)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {vendorChallans.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No challans recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const color =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`mt-1 text-2xl font-bold font-mono-num ${color}`}>{value}</div>
    </div>
  );
}
