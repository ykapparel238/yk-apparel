import { PageHeader } from "@/components/PageHeader";
import { vendors } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Vendors() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return (
    <div>
      <PageHeader
        eyebrow="Supply Chain"
        title="Vendors & Subcontractors"
        description="Job work assignment, performance tracking, scorecards"
        actions={
          <Button size="sm" className="h-9">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Vendor
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendors.map((v) => (
          <div key={v.id} className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-num">{v.id}</div>
                <h3 className="font-semibold mt-0.5">{v.name}</h3>
                <div className="text-xs text-muted-foreground mt-0.5">Process · {v.process}</div>
              </div>
              <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-primary-soft text-primary">
                Active
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Capacity</div>
                <div className="text-sm font-bold font-mono-num mt-0.5">{fmt(v.capacity)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Pending</div>
                <div className="text-sm font-bold font-mono-num mt-0.5 text-warning">{fmt(v.pending)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">OTD</div>
                <div className={`text-sm font-bold font-mono-num mt-0.5 ${v.otd >= 90 ? "text-success" : "text-warning"}`}>
                  {v.otd}%
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-muted-foreground">Quality Score</span>
                <span className="font-mono-num font-semibold">{v.quality}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-success" style={{ width: `${v.quality}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
