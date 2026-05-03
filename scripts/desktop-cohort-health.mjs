import { buildDesktopDiagnostics } from "./desktop-runtime-utils.mjs";

const diagnostics = buildDesktopDiagnostics();

if (!diagnostics.ok) {
  console.log(JSON.stringify({
    go: false,
    status: "NO_LOCAL_DB",
    diagnostics,
  }, null, 2));
  process.exit(1);
}

const pending = diagnostics.bundleCounts.pending ?? 0;
const failed = diagnostics.bundleCounts.failed ?? 0;
const conflicts = diagnostics.conflictCount ?? 0;
const deadLetters = diagnostics.deadLetterCount ?? 0;
const blocked = diagnostics.rebuildRequired || diagnostics.accessState === "locked";

const go = !blocked && failed === 0 && conflicts === 0 && deadLetters === 0;

console.log(JSON.stringify({
  go,
  status: go ? "GO" : "ATTENTION",
  summary: {
    accessState: diagnostics.accessState,
    rebuildRequired: diagnostics.rebuildRequired,
    pendingBundles: pending,
    failedBundles: failed,
    conflicts,
    deadLetters,
  },
  deviceId: diagnostics.deviceId,
  checkpointId: diagnostics.checkpointId,
}, null, 2));

process.exit(go ? 0 : 1);
