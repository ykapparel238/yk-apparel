import { PageHeader } from "@/components/PageHeader";
import { fetchMrp, fetchReportRows, fetchReports } from "@/lib/services";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import type { ReportRowsPayload } from "@/lib/types";

export default function Reports() {
  const [preview, setPreview] = useState<ReportRowsPayload | null>(null);
  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
  });
  const mrpQuery = useQuery({
    queryKey: ["mrp"],
    queryFn: fetchMrp,
  });
  const previewMutation = useMutation({
    mutationFn: fetchReportRows,
    onSuccess: (data) => setPreview(data),
    onError: (error) => {
      toast.error("Unable to run report", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (reportsQuery.isLoading || mrpQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading reports...</div>;
  }

  if (reportsQuery.isError || !reportsQuery.data || mrpQuery.isError || !mrpQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load reports.</div>;
  }

  const reports = reportsQuery.data.items;
  const shortages = mrpQuery.data.items.filter((item) => item.shortage > 0).slice(0, 8);
  const previewColumns = useMemo(() => (preview?.rows[0] ? Object.keys(preview.rows[0]) : []), [preview]);

  const downloadCsv = (report: (typeof reports)[number]) => {
    window.open(report.downloadUrl, "_blank", "noopener,noreferrer");
  };

  const downloadPdf = (report: (typeof reports)[number]) => {
    window.open(report.pdfUrl, "_blank", "noopener,noreferrer");
  };

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
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => downloadCsv(report)}>
                    <Download className="h-3 w-3 mr-1.5" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => downloadPdf(report)}>
                    <Download className="h-3 w-3 mr-1.5" /> PDF
                  </Button>
                  <Button size="sm" className="h-8 text-xs ml-auto" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate(report.slug)}>
                    {previewMutation.isPending ? "Running..." : "Run Report"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden mt-4">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Material Requirement Watch</h3>
          <p className="text-xs text-muted-foreground">Live shortage view from BOM vs free stock</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Material</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold text-right">Required</th>
              <th className="px-4 py-3 font-semibold text-right">Free</th>
              <th className="px-4 py-3 font-semibold text-right">Shortage</th>
              <th className="px-4 py-3 font-semibold">Request</th>
            </tr>
          </thead>
          <tbody>
            {shortages.length ? shortages.map((item) => (
              <tr key={item.materialId} className="data-table-row">
                <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{item.sku}</td>
                <td className="px-4 py-3 font-medium">{item.material}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{item.supplier}</td>
                <td className="px-4 py-3 text-right font-mono-num">{item.required.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right font-mono-num">{item.free.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right font-mono-num text-destructive">{item.shortage.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-xs">
                  {item.activeProcurementRequest ? `${item.activeProcurementRequest.status} • ${item.activeProcurementRequest.requestedQty.toLocaleString("en-IN")}` : "Not raised"}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No active shortages. Free stock currently covers open demand.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {shortages.length ? (
          <div className="px-5 py-3 border-t border-border text-xs text-warning flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            {shortages.length} materials currently have a shortage position.
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.name ?? "Report Preview"}</DialogTitle>
            <DialogDescription>
              {preview ? `${preview.rows.length.toLocaleString("en-IN")} rows available in ${preview.category}.` : "Preview report output."}
            </DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-lg overflow-auto max-h-[480px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  {previewColumns.map((column) => (
                    <th key={column} className="px-4 py-3 font-semibold whitespace-nowrap">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview?.rows.slice(0, 12).map((row, index) => (
                  <tr key={index} className="data-table-row">
                    {previewColumns.map((column) => (
                      <td key={column} className="px-4 py-3 text-xs whitespace-nowrap">{String(row[column] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
