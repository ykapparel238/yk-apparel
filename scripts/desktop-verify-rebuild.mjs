import { buildDesktopDiagnostics } from "./desktop-runtime-utils.mjs";

const diagnostics = buildDesktopDiagnostics();
const snapshotCount = diagnostics.snapshots?.length ?? 0;
const checkpointCount = diagnostics.checkpoints?.length ?? 0;
const hasCheckpoint = checkpointCount > 0 || Boolean(diagnostics.checkpointId);
const ok = Boolean(diagnostics.ok) && !diagnostics.rebuildRequired && snapshotCount > 0 && hasCheckpoint;

console.log(JSON.stringify({
  ok,
  dbPath: diagnostics.dbPath,
  rebuildRequired: diagnostics.rebuildRequired ?? null,
  accessState: diagnostics.accessState ?? null,
  snapshotCount,
  checkpointCount,
  checkpointId: diagnostics.checkpointId ?? null,
  recommendation: ok
    ? "Rebuild state is healthy."
    : "Run Rebuild Cache from the desktop Sync Issues panel, then rerun this verification.",
}, null, 2));

process.exit(ok ? 0 : 1);
