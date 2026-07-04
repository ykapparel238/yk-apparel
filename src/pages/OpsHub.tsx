import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Factory, PackageCheck, ShieldCheck, Truck, Users2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchOpsToday } from "@/lib/services";
import type { OpsWorkItem } from "@/lib/types";
import { useRole } from "@/context/RoleContext";

const moduleIcons = {
  production: Factory,
  qa: ShieldCheck,
  inventory: PackageCheck,
  vendors: Users2,
  dispatch: Truck,
  settings: Wrench,
  sync: Wrench,
  orders: AlertTriangle,
  alerts: AlertTriangle,
};

const severityClasses: Record<string, string> = {
  critical: "border-destructive/30 bg-destructive/5 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-primary/20 bg-primary-soft text-primary",
  success: "border-success/30 bg-success/10 text-success",
};

export default function OpsHub() {
  const { role } = useRole();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["ops-today"], queryFn: fetchOpsToday, refetchInterval: 60_000 });

  if (query.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading guided operations...</div>;
  }

  if (query.isError || !query.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load guided operations.</div>;
  }

  const payload = query.data;
  const grouped = groupByModule(payload.workItems);

  const openItem = (item: OpsWorkItem) => {
    const route = item.action?.route || item.route || "/";
    navigate(route, { state: { opsAction: item.action, opsItemId: item.id } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{role} / {payload.date}</div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Guided Ops Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">One queue for the next actions that keep production moving.</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Critical" value={payload.summary?.critical ?? 0} tone="critical" />
        <MetricCard label="Warnings" value={payload.summary?.warning ?? 0} tone="warning" />
        <MetricCard label="Actionable" value={payload.summary?.actionable ?? 0} tone="info" />
        <MetricCard label="Total Work" value={payload.summary?.total ?? payload.workItems.length} tone="success" />
      </div>

      {(payload.syncHealth?.conflicts || payload.syncHealth?.devicesNeedingRebuild) ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Desktop sync needs attention: {payload.syncHealth.conflicts} conflicts, {payload.syncHealth.devicesNeedingRebuild} rebuilds.
        </div>
      ) : null}

      {payload.workItems.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Object.entries(grouped).map(([module, items]) => (
            <section key={module} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {renderModuleIcon(module)}
                  <h2 className="text-sm font-semibold capitalize">{module.replaceAll("_", " ")}</h2>
                </div>
                <Badge variant="outline">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/50"
                    onClick={() => openItem(item)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{item.title}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${severityClasses[item.severity] ?? severityClasses.info}`}>
                            {item.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {item.assignedRole ? <span>{item.assignedRole}</span> : null}
                          {item.dueAt ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{item.dueAt.slice(0, 10)}</span> : null}
                          <span>{item.entityType}</span>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                        {item.action?.label ?? "Open"} <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <h2 className="mt-3 text-sm font-semibold">No priority work right now</h2>
          <p className="mt-1 text-sm text-muted-foreground">The queue is clear for your role.</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border p-4 ${severityClasses[tone] ?? severityClasses.info}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function groupByModule(items: OpsWorkItem[]) {
  return items.reduce<Record<string, OpsWorkItem[]>>((groups, item) => {
    groups[item.module] = groups[item.module] ?? [];
    groups[item.module].push(item);
    return groups;
  }, {});
}

function renderModuleIcon(module: string) {
  const Icon = moduleIcons[module as keyof typeof moduleIcons] ?? AlertTriangle;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}
