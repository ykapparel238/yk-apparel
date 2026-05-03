import { useMemo, useState } from "react";
import { AlertTriangle, DatabaseZap, Download, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useDesktopSync } from "@/context/DesktopSyncContext";

export function DesktopSyncPanel() {
  const [open, setOpen] = useState(false);
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const {
    diagnostics,
    status,
    refreshDiagnostics,
    runSyncNow,
    retryFailedBundles,
    rebuildCache,
    exportDiagnostics,
    exportBackup,
    resolveConflict,
  } = useDesktopSync();

  if (!status.isDesktop) return null;

  const recentRuns = useMemo(() => diagnostics?.recentRuns ?? [], [diagnostics?.recentRuns]);

  return (
    <Sheet open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) void refreshDiagnostics();
    }}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-xs">
          Sync Issues
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Desktop Sync Health</SheetTitle>
          <SheetDescription>
            Inspect local sync state, retry work, export diagnostics, and rebuild the offline cache when required.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Pending Bundles" value={String(diagnostics?.pendingBundles ?? status.pendingBundles)} />
            <Metric label="Failed Bundles" value={String(diagnostics?.failedBundles ?? status.failedBundles)} />
            <Metric label="Conflicts" value={String(diagnostics?.conflictCount ?? status.conflictCount)} />
            <Metric label="Dead Letters" value={String(diagnostics?.deadLetters ?? status.deadLetters)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void runSyncNow()}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Run Sync Now
            </Button>
            <Button variant="outline" size="sm" onClick={() => void retryFailedBundles()}>
              Retry Failed
            </Button>
            <Button variant="outline" size="sm" onClick={() => void rebuildCache()}>
              <DatabaseZap className="mr-1.5 h-3.5 w-3.5" /> Rebuild Cache
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportDiagnostics()}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Diagnostics
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportBackup()}>
              Export Backup
            </Button>
          </div>

          {diagnostics?.conflicts.length ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" /> Conflicts
              </div>
              <Accordion type="multiple" className="space-y-2">
                {diagnostics.conflicts.map((conflict) => (
                  <AccordionItem key={conflict.id} value={conflict.id} className="rounded border border-border bg-background px-3">
                    <AccordionTrigger className="py-3 text-left text-xs">
                      <div>
                        <div className="font-medium">{conflict.summary}</div>
                        <div className="mt-1 text-muted-foreground">
                          {conflict.entityType} • {conflict.entityId} • {conflict.conflictType}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-3 text-xs">
                      <div className="grid gap-3 md:grid-cols-2">
                        <JsonCard label="Local Snapshot" value={conflict.localSnapshot} />
                        <JsonCard label="Server Snapshot" value={conflict.serverSnapshot} />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Resolution Rationale
                        </div>
                        <Textarea
                          className="min-h-[88px] text-xs"
                          placeholder="Why is this the safe resolution for operations?"
                          value={rationales[conflict.id] ?? ""}
                          onChange={(event) => {
                            setRationales((current) => ({ ...current, [conflict.id]: event.target.value }));
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => void resolveConflict(conflict.id, "keep_local", rationales[conflict.id] || "Resolved from desktop sync panel")}
                        >
                          Keep Local
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => void resolveConflict(conflict.id, "keep_server", rationales[conflict.id] || "Resolved from desktop sync panel")}
                        >
                          Keep Server
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => void resolveConflict(conflict.id, "dismiss", rationales[conflict.id] || "Dismissed from desktop sync panel")}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : null}

          {diagnostics?.deadLetterItems.length ? (
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 text-sm font-medium">Dead Letters</div>
              <div className="space-y-2">
                {diagnostics.deadLetterItems.map((item) => (
                  <div key={`${item.bundleId}-${item.entityId}`} className="rounded border border-border bg-background p-3 text-xs">
                    <div className="font-medium">{item.entityType} • {item.entityId}</div>
                    <div className="mt-1 text-muted-foreground">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {recentRuns.length ? (
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 text-sm font-medium">Recent Sync Runs</div>
              <div className="space-y-2">
                {recentRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="rounded border border-border bg-background p-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{run.status}</span>
                      <span className="text-muted-foreground">{run.startedAt}</span>
                    </div>
                    {run.message ? <div className="mt-1 text-muted-foreground">{run.message}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function JsonCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded border border-border bg-muted/20 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
