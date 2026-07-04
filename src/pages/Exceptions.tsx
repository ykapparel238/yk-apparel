import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Button } from "@/components/ui/button";
import { fetchExceptions } from "@/lib/services";

export default function Exceptions() {
  const query = useQuery({
    queryKey: ["exceptions"],
    queryFn: fetchExceptions,
  });

  if (query.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading exception command center...</div>;
  }

  if (query.isError || !query.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load exception command center.</div>;
  }

  const { kpis, byOwner, byModule, items, generatedAt } = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Control"
        title="Exception Command Center"
        description={`Auto-detected workflow blockers and escalations · refreshed ${generatedAt.slice(0, 16).replace("T", " ")}`}
        actions={
          <Button asChild size="sm" className="h-9">
            <Link to="/mobile">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Mobile Work
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Open Exceptions" value={kpis.total} hint="active blockers" icon={ShieldAlert} tone={kpis.total ? "warning" : "success"} />
        <KpiCard label="Critical" value={kpis.critical} hint="needs escalation" icon={AlertTriangle} tone={kpis.critical ? "destructive" : "success"} />
        <KpiCard label="Warnings" value={kpis.warning} hint="at risk" icon={Clock} tone={kpis.warning ? "warning" : "success"} />
        <KpiCard label="Clear" value={kpis.total ? "No" : "Yes"} hint="exception-free flow" icon={CheckCircle2} tone={kpis.total ? "info" : "success"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Breakdown title="Owner Load" items={byOwner.map((item) => ({ label: item.owner, count: item.count }))} />
        <Breakdown title="Module Load" items={byModule.map((item) => ({ label: item.module, count: item.count }))} />
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold">Operating Rule</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Critical items should be handled first. Warning items are at risk. Info items are useful queues that can still become blockers if ignored.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Exception Queue</h3>
          <p className="text-xs text-muted-foreground">Owner, age, impact, and next action</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Issue</th>
                <th className="px-4 py-3 font-semibold">Module</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold text-right">Age</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="data-table-row align-top">
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-1 text-[10px] font-semibold ${severityClass(item.severity)}`}>
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[260px]">
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.summary}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{item.module}</td>
                  <td className="px-4 py-3 text-xs">{item.owner}</td>
                  <td className="px-4 py-3 text-right font-mono-num">{item.ageDays}d</td>
                  <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">{item.dueDate ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                      <Link to={item.href}>{item.actionLabel}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No active exceptions. Production flow is clean.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{item.label}</span>
              <span className="font-mono-num text-muted-foreground">{item.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((item.count / max) * 100)}%` }} />
            </div>
          </div>
        )) : <p className="text-xs text-muted-foreground">No active load.</p>}
      </div>
    </div>
  );
}

function severityClass(severity: string) {
  if (severity === "critical") return "bg-destructive/10 text-destructive";
  if (severity === "warning") return "bg-warning/10 text-warning";
  return "bg-info/10 text-info";
}
