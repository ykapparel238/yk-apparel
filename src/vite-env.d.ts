/// <reference types="vite/client" />

import type { AuthUser, DesktopSyncStatus, DiagnosticsSnapshot } from "@/lib/types";

declare global {
  interface Window {
    desktopBridge?: {
      readonly isDesktop: boolean;
      readonly apiBaseUrl: string;
      getSyncStatus: () => Promise<DesktopSyncStatus>;
      runSyncNow: () => Promise<DesktopSyncStatus>;
      getDiagnostics: () => Promise<DiagnosticsSnapshot>;
      exportDiagnostics: () => Promise<{ path: string | null }>;
      exportBackup: () => Promise<{ path: string | null }>;
      retryFailedBundles: () => Promise<DesktopSyncStatus>;
      rebuildCache: () => Promise<DesktopSyncStatus>;
      resolveConflict: (conflictId: string, choice: "keep_local" | "keep_server" | "dismiss", rationale?: string) => Promise<DesktopSyncStatus>;
      querySnapshot: <T>(resource: string, params?: Record<string, unknown>) => Promise<T | null>;
      seedSnapshots: (snapshots: Record<string, unknown>) => Promise<void>;
      enqueueMutation: <T>(mutation: {
        entityType: string;
        entityId: string;
        operationType: string;
        payload: unknown;
        baseVersion?: string | null;
      }) => Promise<T>;
      getCachedSession: () => Promise<AuthUser | null>;
      setCachedSession: (user: AuthUser) => Promise<void>;
      clearCachedSession: () => Promise<void>;
      onStatusChange: (callback: (status: DesktopSyncStatus) => void) => () => void;
    };
  }
}

export {};
