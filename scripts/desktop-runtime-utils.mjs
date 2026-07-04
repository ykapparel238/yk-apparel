import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const APP_SUPPORT_DIR = path.join(os.homedir(), "Library", "Application Support");
const DB_CANDIDATES = [
  path.join(APP_SUPPORT_DIR, "YK Apparels", "offline-yk-apparels.db"),
  path.join(APP_SUPPORT_DIR, "Electron", "offline-yk-apparels.db"),
  path.join(APP_SUPPORT_DIR, "vite_react_shadcn_ts", "offline-yk-apparels.db"),
];

export function getDesktopDbPath() {
  if (process.env.YK_APPARELS_DESKTOP_DB_PATH) {
    return process.env.YK_APPARELS_DESKTOP_DB_PATH;
  }

  const existing = DB_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  return existing ?? DB_CANDIDATES[0];
}

export function desktopDbExists() {
  return fs.existsSync(getDesktopDbPath());
}

export function openDesktopDb() {
  return new DatabaseSync(getDesktopDbPath(), { readOnly: true });
}

export function readClientState(db) {
  const rows = db.prepare("SELECT key, value, updated_at FROM client_state ORDER BY key ASC").all();
  return Object.fromEntries(rows.map((row) => {
    try {
      return [row.key, JSON.parse(row.value)];
    } catch {
      return [row.key, row.value];
    }
  }));
}

export function buildDesktopDiagnostics() {
  if (!desktopDbExists()) {
    return {
      ok: false,
      dbPath: getDesktopDbPath(),
      reason: "offline_db_missing",
    };
  }

  const db = openDesktopDb();
  const clientState = readClientState(db);
  const bundleCounts = Object.fromEntries(
    db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM sync_bundles
      GROUP BY status
    `).all().map((row) => [row.status, Number(row.count)]),
  );
  const mutationCounts = Object.fromEntries(
    db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM outbox_mutations
      GROUP BY status
    `).all().map((row) => [row.status, Number(row.count)]),
  );
  const conflicts = db.prepare("SELECT * FROM sync_conflicts ORDER BY created_at DESC LIMIT 50").all();
  const deadLetters = db.prepare("SELECT * FROM sync_dead_letters ORDER BY created_at DESC LIMIT 50").all();
  const recentRuns = db.prepare("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 20").all();
  const oldestPending = db.prepare(`
    SELECT created_at
    FROM sync_bundles
    WHERE status IN ('pending', 'failed', 'syncing')
    ORDER BY created_at ASC
    LIMIT 1
  `).get();
  const snapshotRows = db.prepare(`
    SELECT resource_key, updated_at, LENGTH(payload) AS payload_size
    FROM local_snapshots
    ORDER BY resource_key ASC
  `).all();
  const checkpointRows = db.prepare("SELECT * FROM pull_checkpoints ORDER BY created_at DESC LIMIT 10").all();

  return {
    ok: true,
    dbPath: getDesktopDbPath(),
    deviceId: clientState.deviceId ?? null,
    checkpointId: clientState.checkpointId ?? null,
    accessState: clientState.accessState ?? "valid",
    rebuildRequired: Boolean(clientState.rebuildRequired),
    bundleCounts,
    mutationCounts,
    conflictCount: conflicts.length,
    deadLetterCount: deadLetters.length,
    oldestPendingBundleAgeMinutes: oldestPending
      ? Math.round((Date.now() - new Date(oldestPending.created_at).getTime()) / 60000)
      : null,
    recentRuns: recentRuns.map((row) => ({
      id: row.id,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      message: row.message,
    })),
    conflicts: conflicts.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      bundleId: row.bundle_id,
      mutationId: row.mutation_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      conflictType: row.conflict_type,
      summary: row.summary,
      createdAt: row.created_at,
    })),
    deadLetters: deadLetters.map((row) => ({
      id: row.id,
      bundleId: row.bundle_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reason: row.reason,
      createdAt: row.created_at,
    })),
    snapshots: snapshotRows.map((row) => ({
      resourceKey: row.resource_key,
      updatedAt: row.updated_at,
      payloadSize: Number(row.payload_size),
    })),
    checkpoints: checkpointRows.map((row) => ({
      checkpointId: row.checkpoint_id,
      status: row.status,
      cursorAt: row.cursor_at,
      createdAt: row.created_at,
    })),
    clientState,
  };
}

export function parseFlagValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}
