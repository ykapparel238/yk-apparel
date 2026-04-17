import { PageHeader } from "@/components/PageHeader";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const reports = [
  { name: "Daily Production Report", desc: "Stage-wise output, efficiency, rejection by line", category: "Production" },
  { name: "Order Status Report", desc: "PO lifecycle, delays, dispatch readiness", category: "Merchandising" },
  { name: "Line Performance", desc: "Efficiency, output, downtime per knitting line", category: "Production" },
  { name: "Vendor Performance Scorecard", desc: "OTD, quality, capacity utilization", category: "Vendor" },
  { name: "Stock Report", desc: "Yarn, trims, packing — current and aged inventory", category: "Stores" },
  { name: "Rejection & Rework Report", desc: "Defect analysis, root cause, vendor breakdown", category: "QA" },
  { name: "Dispatch Report", desc: "Shipment status, OTIF, brand-wise delivery", category: "Logistics" },
  { name: "Management Summary", desc: "Executive KPIs across all departments", category: "Executive" },
];

export default function Reports() {
  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Reports & Exports"
        description="Generate and download standard manufacturing reports"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.name} className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-primary-soft text-primary grid place-items-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{r.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                    {r.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Download className="h-3 w-3 mr-1.5" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Download className="h-3 w-3 mr-1.5" /> PDF
                  </Button>
                  <Button size="sm" className="h-8 text-xs ml-auto">
                    Run Report
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
