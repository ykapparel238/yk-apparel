import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { fetchPlanningCalendar } from "@/lib/services";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const calendarQuery = useQuery({
    queryKey: ["planning-calendar", "2024-11"],
    queryFn: () => fetchPlanningCalendar("2024-11"),
  });

  // Pad start so day 1 falls on column ~Wed for visual variety
  const padding = Array.from({ length: 2 }, (_, i) => i);

  if (calendarQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading production calendar...</div>;
  }

  if (calendarQuery.isError || !calendarQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load production calendar.</div>;
  }

  const { days: calendarDays, lines, monthLabel } = calendarQuery.data;

  return (
    <div>
      <PageHeader
        eyebrow="Planner"
        title="Production Calendar"
        description="November 2024 — daily target vs actual output across all lines"
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 px-3">
              {monthLabel}
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs mb-4">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-success" /> On / Above target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-warning" /> Within 85%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-destructive" /> Missed
        </span>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {weekdays.map((d) => (
            <div
              key={d}
              className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {padding.map((p) => (
            <div key={`p${p}`} className="border-b border-r border-border min-h-[110px] bg-muted/10" />
          ))}
          {calendarDays.map((d) => {
            const tone =
              d.status === "ok"
                ? "border-l-success"
                : d.status === "warn"
                ? "border-l-warning"
                : "border-l-destructive";
            const pct = Math.round((d.actual / d.target) * 100);
            return (
              <div
                key={d.day}
                className={`border-b border-r border-border border-l-2 ${tone} min-h-[110px] p-2 hover:bg-muted/30 transition-colors cursor-pointer`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold font-mono-num">{d.day}</span>
                  <span
                    className={`text-[10px] font-mono-num ${
                      d.status === "ok"
                        ? "text-success"
                        : d.status === "warn"
                        ? "text-warning"
                        : "text-destructive"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] text-muted-foreground">Target</div>
                  <div className="text-xs font-mono-num font-medium">{fmt(d.target)}</div>
                </div>
                <div className="mt-1">
                  <div className="text-[10px] text-muted-foreground">Actual</div>
                  <div className="text-xs font-mono-num font-semibold">{fmt(d.actual)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Line allocation */}
      <div className="bg-card border border-border rounded-lg p-5 mt-6">
        <h3 className="text-sm font-semibold mb-1">Line Allocation Today</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Active POs assigned to each production line
        </p>
        <div className="space-y-2.5">
          {lines.map((l, i) => {
            return (
              <div key={l.id} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <div className="text-xs font-medium">{l.name}</div>
                  <div className="text-[10px] text-muted-foreground">{l.gauge}</div>
                </div>
                <div className="flex-1 h-7 bg-muted rounded overflow-hidden flex">
                  {l.allocations.map((allocation, index) => (
                    <div
                      key={`${l.id}-${allocation.poNumber}-${index}`}
                      className={`${index === 0 ? "bg-chart-1" : "bg-chart-3"} h-full flex items-center px-2 text-[10px] text-primary-foreground font-medium truncate`}
                      style={{ width: `${allocation.width}%` }}
                    >
                      {allocation.poNumber}
                    </div>
                  ))}
                </div>
                <div className="w-12 text-right text-xs font-mono-num font-semibold">
                  {l.fill}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
