import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  exportDesktopBackup,
  exportDesktopDiagnostics,
  getDesktopSyncStatus,
  readDesktopDiagnostics,
  rebuildDesktopCache,
  resolveDesktopConflict,
  retryDesktopFailedBundles,
  runDesktopSyncNow,
} from "@/lib/desktopBridge";
import type { ConflictResolutionChoice, DesktopSyncStatus, DiagnosticsSnapshot } from "@/lib/types";

type DesktopSyncContextValue = {
  status: DesktopSyncStatus;
  diagnostics: DiagnosticsSnapshot | null;
  refreshStatus: () => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  runSyncNow: () => Promise<void>;
  retryFailedBundles: () => Promise<void>;
  rebuildCache: () => Promise<void>;
  exportDiagnostics: () => Promise<void>;
  exportBackup: () => Promise<void>;
  resolveConflict: (conflictId: string, choice: ConflictResolutionChoice, rationale?: string) => Promise<void>;
};

const DesktopSyncContext = createContext<DesktopSyncContextValue | null>(null);

const fallbackStatus: DesktopSyncStatus = {
  isDesktop: false,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  state: typeof navigator === "undefined" || navigator.onLine ? "idle" : "offline",
  pendingBundles: 0,
  failedBundles: 0,
  conflictCount: 0,
  deadLetters: 0,
  lastSyncAt: null,
  rebuildRequired: false,
};

export function DesktopSyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DesktopSyncStatus>(fallbackStatus);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSnapshot | null>(null);

  const refreshStatus = async () => {
    setStatus(await getDesktopSyncStatus());
  };

  const refreshDiagnostics = async () => {
    if (!window.desktopBridge?.isDesktop) {
      setDiagnostics(null);
      return;
    }
    setDiagnostics(await readDesktopDiagnostics());
  };

  useEffect(() => {
    void refreshStatus();

    if (!window.desktopBridge?.isDesktop) return;

    void refreshDiagnostics();
    const dispose = window.desktopBridge.onStatusChange((nextStatus) => {
      setStatus(nextStatus);
      void refreshDiagnostics();
    });

    return dispose;
  }, []);

  const value = useMemo<DesktopSyncContextValue>(() => ({
    status,
    diagnostics,
    refreshStatus,
    refreshDiagnostics,
    runSyncNow: async () => {
      setStatus(await runDesktopSyncNow());
      await refreshDiagnostics();
    },
    retryFailedBundles: async () => {
      setStatus(await retryDesktopFailedBundles());
      await refreshDiagnostics();
    },
    rebuildCache: async () => {
      setStatus(await rebuildDesktopCache());
      await refreshDiagnostics();
    },
    exportDiagnostics: async () => {
      await exportDesktopDiagnostics();
    },
    exportBackup: async () => {
      await exportDesktopBackup();
    },
    resolveConflict: async (conflictId, choice, rationale) => {
      await resolveDesktopConflict(conflictId, choice, rationale);
      await refreshStatus();
      await refreshDiagnostics();
    },
  }), [diagnostics, status]);

  return <DesktopSyncContext.Provider value={value}>{children}</DesktopSyncContext.Provider>;
}

export function useDesktopSync() {
  const context = useContext(DesktopSyncContext);
  if (!context) {
    throw new Error("useDesktopSync must be used inside DesktopSyncProvider");
  }
  return context;
}
