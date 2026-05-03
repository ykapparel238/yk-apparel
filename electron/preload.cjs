const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopBridge", {
  isDesktop: true,
  apiBaseUrl: process.env.DESKTOP_API_BASE_URL || "http://127.0.0.1:4000",
  getSyncStatus: () => ipcRenderer.invoke("desktop:get-sync-status"),
  runSyncNow: () => ipcRenderer.invoke("desktop:run-sync-now"),
  getDiagnostics: () => ipcRenderer.invoke("desktop:get-diagnostics"),
  exportDiagnostics: () => ipcRenderer.invoke("desktop:export-diagnostics"),
  exportBackup: () => ipcRenderer.invoke("desktop:export-backup"),
  retryFailedBundles: () => ipcRenderer.invoke("desktop:retry-failed-bundles"),
  rebuildCache: () => ipcRenderer.invoke("desktop:rebuild-cache"),
  resolveConflict: (conflictId, choice, rationale) => ipcRenderer.invoke("desktop:resolve-conflict", conflictId, choice, rationale),
  querySnapshot: (resource, params) => ipcRenderer.invoke("desktop:query-snapshot", resource, params),
  seedSnapshots: (snapshots) => ipcRenderer.invoke("desktop:seed-snapshots", snapshots),
  enqueueMutation: (mutation) => ipcRenderer.invoke("desktop:enqueue-mutation", mutation),
  getCachedSession: () => ipcRenderer.invoke("desktop:get-cached-session"),
  setCachedSession: (user) => ipcRenderer.invoke("desktop:set-cached-session", user),
  clearCachedSession: () => ipcRenderer.invoke("desktop:clear-cached-session"),
  onStatusChange: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("desktop-sync:status", listener);
    return () => ipcRenderer.removeListener("desktop-sync:status", listener);
  },
});
