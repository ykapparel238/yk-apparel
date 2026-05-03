import { buildDesktopDiagnostics, desktopDbExists, getDesktopDbPath, openDesktopDb, parseFlagValue } from "./desktop-runtime-utils.mjs";

const bundleId = parseFlagValue("--bundle");
const mutationId = parseFlagValue("--mutation");
const deviceId = parseFlagValue("--device");

if (!desktopDbExists()) {
  console.log(JSON.stringify({
    ok: false,
    dbPath: getDesktopDbPath(),
    reason: "offline_db_missing",
  }, null, 2));
  process.exit(1);
}

const db = openDesktopDb();
const diagnostics = buildDesktopDiagnostics();

const result = {
  ok: true,
  dbPath: getDesktopDbPath(),
  filters: { bundleId, mutationId, deviceId },
  diagnosticsSummary: {
    accessState: diagnostics.accessState,
    rebuildRequired: diagnostics.rebuildRequired,
    bundleCounts: diagnostics.bundleCounts,
    mutationCounts: diagnostics.mutationCounts,
  },
  bundles: [],
  mutations: [],
  conflicts: [],
  deadLetters: [],
};

if (bundleId) {
  result.bundles = db.prepare("SELECT * FROM sync_bundles WHERE bundle_id = ?").all(bundleId);
  result.mutations = db.prepare("SELECT * FROM outbox_mutations WHERE bundle_id = ? ORDER BY created_at ASC").all(bundleId);
  result.conflicts = db.prepare("SELECT * FROM sync_conflicts WHERE bundle_id = ? ORDER BY created_at DESC").all(bundleId);
  result.deadLetters = db.prepare("SELECT * FROM sync_dead_letters WHERE bundle_id = ? ORDER BY created_at DESC").all(bundleId);
} else if (mutationId) {
  result.mutations = db.prepare("SELECT * FROM outbox_mutations WHERE mutation_id = ?").all(mutationId);
  result.conflicts = db.prepare("SELECT * FROM sync_conflicts WHERE mutation_id = ? ORDER BY created_at DESC").all(mutationId);
} else if (deviceId) {
  result.bundles = db.prepare("SELECT * FROM sync_bundles WHERE device_id = ? ORDER BY created_at DESC LIMIT 50").all(deviceId);
  result.mutations = db.prepare("SELECT * FROM outbox_mutations WHERE device_id = ? ORDER BY created_at DESC LIMIT 50").all(deviceId);
  result.conflicts = db.prepare("SELECT * FROM sync_conflicts WHERE device_id = ? ORDER BY created_at DESC LIMIT 50").all(deviceId);
} else {
  result.bundles = db.prepare("SELECT * FROM sync_bundles ORDER BY created_at DESC LIMIT 20").all();
  result.mutations = db.prepare("SELECT * FROM outbox_mutations ORDER BY created_at DESC LIMIT 20").all();
  result.conflicts = db.prepare("SELECT * FROM sync_conflicts ORDER BY created_at DESC LIMIT 20").all();
  result.deadLetters = db.prepare("SELECT * FROM sync_dead_letters ORDER BY created_at DESC LIMIT 20").all();
}

console.log(JSON.stringify(result, null, 2));
