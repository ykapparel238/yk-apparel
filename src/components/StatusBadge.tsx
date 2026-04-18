import { Badge } from "@/components/ui/badge";
import { OrderStatus } from "@/lib/mockData";

const map: Record<string, string> = {
  Created: "bg-muted text-muted-foreground border-border",
  Planned: "bg-info-soft text-info border-info/20",
  "In Production": "bg-primary-soft text-primary border-primary/20",
  QA: "bg-warning-soft text-warning border-warning/30",
  Dispatched: "bg-success-soft text-success border-success/30",
  Delayed: "bg-destructive/10 text-destructive border-destructive/30",
  Critical: "bg-destructive/10 text-destructive border-destructive/30",
  High: "bg-warning-soft text-warning border-warning/30",
  Medium: "bg-info-soft text-info border-info/20",
  Low: "bg-muted text-muted-foreground border-border",
  Open: "bg-info-soft text-info border-info/20",
  Partial: "bg-warning-soft text-warning border-warning/30",
  Closed: "bg-success-soft text-success border-success/30",
  Active: "bg-success-soft text-success border-success/30",
  Inactive: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: OrderStatus | string }) {
  return (
    <Badge
      variant="outline"
      className={`font-medium text-[11px] px-2 py-0.5 ${map[status] ?? "bg-muted"}`}
    >
      {status}
    </Badge>
  );
}
