import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}

const toneMap = {
  default: "text-primary bg-primary-soft",
  success: "text-success bg-success-soft",
  warning: "text-warning bg-warning-soft",
  destructive: "text-destructive bg-destructive/10",
  info: "text-info bg-info-soft",
};

export function KpiCard({ label, value, hint, delta, icon: Icon, tone = "default" }: Props) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-num text-foreground">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        {Icon && (
          <div className={cn("h-9 w-9 rounded-md grid place-items-center", toneMap[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {delta !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {delta >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          <span
            className={cn(
              "font-medium font-mono-num",
              delta >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
          <span className="text-muted-foreground">vs last week</span>
        </div>
      )}
    </div>
  );
}
