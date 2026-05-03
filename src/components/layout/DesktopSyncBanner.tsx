import { AlertTriangle, RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesktopSync } from "@/context/DesktopSyncContext";

export function DesktopSyncBanner() {
  const { status, runSyncNow } = useDesktopSync();

  if (!status.isDesktop) return null;

  if (status.rebuildRequired) {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning-foreground">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Desktop cache requires rebuild before more offline work is synced safely.</span>
        </div>
      </div>
    );
  }

  if (status.accessState === "locked") {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>This desktop has been locked. Local data stays visible, but sign-in and sync are blocked until access is restored.</span>
        </div>
      </div>
    );
  }

  if (status.accessState === "restricted") {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning-foreground">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>This desktop is in restricted mode. You can review local data, but new offline writes are blocked until access is restored.</span>
        </div>
      </div>
    );
  }

  if (status.state === "offline") {
    return (
      <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <WifiOff className="h-3.5 w-3.5" />
          <span>You are offline. Changes are saved locally and will sync when the connection returns.</span>
        </div>
      </div>
    );
  }

  if (status.failedBundles > 0 || status.conflictCount > 0) {
    return (
      <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            Sync needs attention: {status.failedBundles} failed bundle{status.failedBundles === 1 ? "" : "s"}
            {status.conflictCount ? ` and ${status.conflictCount} conflict${status.conflictCount === 1 ? "" : "s"}` : ""}.
          </span>
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void runSyncNow()}>
            <RotateCw className="mr-1 h-3 w-3" /> Retry Sync
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
