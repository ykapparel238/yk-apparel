import { PageHeader } from "@/components/PageHeader";
import { fetchReports } from "@/lib/services";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Reports() {
  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
  });

  if (reportsQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading reports...</div>;
  }

  if (reportsQuery.isError || !reportsQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load reports.</div>;
  }

  const reports = reportsQuery.data.items;

  return (
    <div>
      <PageHeader
        eyebrow="Insights"
        title="Reports & Exports"
        description="Generate and download standard manufacturing reports"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <div key={report.name} className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-primary-soft text-primary grid place-items-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{report.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{report.desc}</p>
                    <p className="text-[11px] text-muted-foreground mt-2">{report.rows.toLocaleString("en-IN")} rows available</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                    {report.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast(`${report.name} CSV export will follow this data pass`)}>
                    <Download className="h-3 w-3 mr-1.5" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast(`${report.name} PDF export will follow this data pass`)}>
                    <Download className="h-3 w-3 mr-1.5" /> PDF
                  </Button>
                  <Button size="sm" className="h-8 text-xs ml-auto" onClick={() => toast(`${report.name}: ${report.rows.toLocaleString("en-IN")} rows ready`)}>
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
