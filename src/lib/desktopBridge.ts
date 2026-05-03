import type { AuthUser, DesktopSyncStatus, DiagnosticsSnapshot } from "@/lib/types";

export function isDesktopRuntime() {
  return Boolean(window.desktopBridge?.isDesktop);
}

export function getApiBaseUrl() {
  return window.desktopBridge?.apiBaseUrl ?? "";
}

export async function getDesktopSyncStatus() {
  return window.desktopBridge?.getSyncStatus() ?? Promise.resolve<DesktopSyncStatus>({
    isDesktop: false,
    online: navigator.onLine,
    state: navigator.onLine ? "idle" : "offline",
    accessState: "valid",
    pendingBundles: 0,
    failedBundles: 0,
    conflictCount: 0,
    deadLetters: 0,
    lastSyncAt: null,
    rebuildRequired: false,
  });
}

export async function runDesktopSyncNow() {
  return window.desktopBridge?.runSyncNow() ?? getDesktopSyncStatus();
}

export async function retryDesktopFailedBundles() {
  return window.desktopBridge?.retryFailedBundles() ?? getDesktopSyncStatus();
}

export async function rebuildDesktopCache() {
  return window.desktopBridge?.rebuildCache() ?? getDesktopSyncStatus();
}

export async function resolveDesktopConflict(conflictId: string, choice: "keep_local" | "keep_server" | "dismiss", rationale?: string) {
  return window.desktopBridge?.resolveConflict(conflictId, choice, rationale) ?? getDesktopSyncStatus();
}

export async function readDesktopDiagnostics() {
  return window.desktopBridge?.getDiagnostics() ?? Promise.resolve<DiagnosticsSnapshot>({
    deviceId: "web",
    checkpointId: null,
    rebuildRequired: false,
    pendingBundles: 0,
    failedBundles: 0,
    syncedBundles: 0,
    deadLetters: 0,
    conflictCount: 0,
    oldestPendingBundleAgeMinutes: null,
    lastSyncAt: null,
    recentRuns: [],
    conflicts: [],
    deadLetterItems: [],
  });
}

export async function exportDesktopDiagnostics() {
  return window.desktopBridge?.exportDiagnostics() ?? { path: null };
}

export async function exportDesktopBackup() {
  return window.desktopBridge?.exportBackup() ?? { path: null };
}

export async function queryDesktopSnapshot<T>(resource: string, params?: Record<string, unknown>) {
  return window.desktopBridge?.querySnapshot<T>(resource, params) ?? null;
}

export async function seedDesktopSnapshots(snapshots: Record<string, unknown>) {
  await window.desktopBridge?.seedSnapshots(snapshots);
}

export async function enqueueDesktopMutation<T>(mutation: {
  entityType: string;
  entityId: string;
  operationType: string;
  payload: unknown;
  baseVersion?: string | null;
}) {
  if (!window.desktopBridge) {
    throw new Error("Desktop bridge is not available");
  }

  return window.desktopBridge.enqueueMutation<T>(mutation);
}

export async function getDesktopCachedSession() {
  return window.desktopBridge?.getCachedSession() ?? Promise.resolve<AuthUser | null>(null);
}

export async function setDesktopCachedSession(user: AuthUser) {
  await window.desktopBridge?.setCachedSession(user);
}

export async function clearDesktopCachedSession() {
  await window.desktopBridge?.clearCachedSession();
}
