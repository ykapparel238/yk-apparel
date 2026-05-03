const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { app, BrowserWindow, dialog, ipcMain, shell, session } = require("electron");
const { DatabaseSync } = require("node:sqlite");

const DESKTOP_CLIENT_VERSION = "1.0.0";
const WORKSPACE_ID = "knitcraft-mes";
const DEFAULT_API_BASE_URL = process.env.DESKTOP_API_BASE_URL || "http://127.0.0.1:4000";
const SNAPSHOT_KEYS = {
  ordersList: "orders.list",
  ordersOptions: "orders.options",
  orderDetails: "orders.details",
  planningBoard: "planning.board",
  inventory: "inventory.data",
  procurementRequests: "inventory.procurementRequests",
  qa: "qa.data",
  dispatch: "dispatch.data",
};

let mainWindow;
let runtimeStatus = {
  isDesktop: true,
  online: true,
  state: "idle",
  accessState: "valid",
  pendingBundles: 0,
  failedBundles: 0,
  conflictCount: 0,
  deadLetters: 0,
  lastSyncAt: null,
  lastSyncError: null,
  rebuildRequired: false,
  deviceId: null,
};

function getUserDataPath() {
  return app.getPath("userData");
}

function getDatabasePath() {
  return path.join(getUserDataPath(), "offline-knitcraft.db");
}

function openDatabase() {
  fs.mkdirSync(getUserDataPath(), { recursive: true });
  const db = new DatabaseSync(getDatabasePath());
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS client_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS local_snapshots (
      resource_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_bundles (
      bundle_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      base_version TEXT,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox_mutations (
      mutation_id TEXT PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      base_version TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pull_checkpoints (
      checkpoint_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      cursor_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      message TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      bundle_id TEXT NOT NULL,
      mutation_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      local_snapshot TEXT NOT NULL,
      server_snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_dead_letters (
      id TEXT PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

const db = openDatabase();

function getClientState(key) {
  const row = db.prepare("SELECT value FROM client_state WHERE key = ?").get(key);
  return row ? JSON.parse(row.value) : null;
}

function setClientState(key, value) {
  db.prepare(`
    INSERT INTO client_state (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), new Date().toISOString());
}

function getDeviceId() {
  let deviceId = getClientState("deviceId");
  if (!deviceId) {
    deviceId = randomUUID();
    setClientState("deviceId", deviceId);
  }
  runtimeStatus.deviceId = deviceId;
  return deviceId;
}

function getCheckpointId() {
  const checkpointId = getClientState("checkpointId");
  if (checkpointId) return checkpointId;
  const row = db.prepare("SELECT checkpoint_id FROM pull_checkpoints ORDER BY created_at DESC LIMIT 1").get();
  return row?.checkpoint_id ?? null;
}

function setCheckpointId(checkpointId) {
  setClientState("checkpointId", checkpointId);
  if (!checkpointId) {
    return;
  }
  db.prepare(`
    INSERT INTO pull_checkpoints (checkpoint_id, status, cursor_at, created_at)
    VALUES (?, 'ok', ?, ?)
    ON CONFLICT(checkpoint_id) DO UPDATE SET status = excluded.status, cursor_at = excluded.cursor_at, created_at = excluded.created_at
  `).run(checkpointId, new Date().toISOString(), new Date().toISOString());
}

function getSnapshot(resourceKey) {
  const row = db.prepare("SELECT payload FROM local_snapshots WHERE resource_key = ?").get(resourceKey);
  return row ? JSON.parse(row.payload) : null;
}

function setSnapshot(resourceKey, payload) {
  db.prepare(`
    INSERT INTO local_snapshots (resource_key, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(resource_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(resourceKey, JSON.stringify(payload), new Date().toISOString());
}

function setSnapshots(snapshots) {
  Object.entries(snapshots).forEach(([key, payload]) => {
    if (payload !== undefined) {
      if (key === SNAPSHOT_KEYS.orderDetails) {
        const current = getSnapshot(key) ?? {};
        setSnapshot(key, { ...current, ...payload });
        return;
      }
      setSnapshot(key, payload);
    }
  });
}

function recordSyncRun(status, message = null, finished = false, runId = null) {
  const id = runId ?? randomUUID();
  if (!finished) {
    db.prepare("INSERT INTO sync_runs (id, status, started_at, message) VALUES (?, ?, ?, ?)").run(id, status, new Date().toISOString(), message);
    return id;
  }
  db.prepare("UPDATE sync_runs SET status = ?, finished_at = ?, message = ? WHERE id = ?").run(status, new Date().toISOString(), message, id);
  return id;
}

function getBundleCounts() {
  const counts = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM sync_bundles
    GROUP BY status
  `).all();
  const map = Object.fromEntries(counts.map((row) => [row.status, Number(row.count)]));
  return {
    pending: map.pending ?? 0,
    syncing: map.syncing ?? 0,
    synced: map.synced ?? 0,
    failed: map.failed ?? 0,
    conflict: map.conflict ?? 0,
    dead_letter: map.dead_letter ?? 0,
  };
}

function refreshRuntimeStatus(overrides = {}) {
  const counts = getBundleCounts();
  runtimeStatus = {
    ...runtimeStatus,
    accessState: getClientState("accessState") ?? runtimeStatus.accessState ?? "valid",
    pendingBundles: counts.pending + counts.syncing,
    failedBundles: counts.failed,
    conflictCount: db.prepare("SELECT COUNT(*) AS count FROM sync_conflicts").get().count,
    deadLetters: db.prepare("SELECT COUNT(*) AS count FROM sync_dead_letters").get().count,
    rebuildRequired: Boolean(getClientState("rebuildRequired")),
    ...overrides,
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop-sync:status", runtimeStatus);
  }
  return runtimeStatus;
}

function filterOrders(items, filters = {}) {
  const q = filters.q ? String(filters.q).trim().toLowerCase() : "";
  return items.filter((item) => {
    if (q) {
      const haystack = [item.poNumber, item.brand, item.style, item.styleName, item.season, item.status].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.status && item.status !== filters.status) return false;
    if (filters.brandId && item.brandId !== filters.brandId) return false;
    if (filters.styleId && item.styleId !== filters.styleId) return false;
    return true;
  });
}

function applyOrderMutation(operationType, entityId, payload, bundleId) {
  const ordersList = getSnapshot(SNAPSHOT_KEYS.ordersList) ?? { items: [] };
  const options = getSnapshot(SNAPSHOT_KEYS.ordersOptions) ?? { brands: [], styles: [] };
  const details = getSnapshot(SNAPSHOT_KEYS.orderDetails) ?? {};
  const brand = options.brands.find((item) => item.id === payload.brandId);
  const style = options.styles.find((item) => item.id === payload.styleId);
  const tempId = entityId.startsWith("local-") ? entityId : `local-${bundleId}`;
  const existing = ordersList.items.find((item) => item.id === entityId || item.poNumber === entityId);
  const nextItem = operationType === "orders.delete" ? null : {
    id: existing?.id ?? tempId,
    poNumber: payload.poNumber ?? existing?.poNumber ?? entityId,
    brandId: payload.brandId ?? existing?.brandId ?? "",
    brand: brand?.name ?? existing?.brand ?? "Pending brand",
    styleId: payload.styleId ?? existing?.styleId ?? "",
    style: style?.code ?? existing?.style ?? "Pending style",
    styleName: style?.name ?? existing?.styleName ?? "Pending style",
    season: payload.seasonCode ?? existing?.season ?? "",
    qty: payload.quantity ?? existing?.qty ?? 0,
    delivered: existing?.delivered ?? 0,
    due: payload.dueDate ?? existing?.due ?? "",
    status: existing?.status ?? "Created",
    priority: payload.priority ?? existing?.priority ?? "Medium",
    progress: existing?.progress ?? 0,
    syncState: "pending",
  };

  const nextItems = operationType === "orders.delete"
    ? ordersList.items.filter((item) => item.id !== entityId)
    : [...ordersList.items.filter((item) => item.id !== nextItem.id), nextItem];
  setSnapshot(SNAPSHOT_KEYS.ordersList, { items: nextItems });

  if (operationType !== "orders.delete") {
    setSnapshot(SNAPSHOT_KEYS.orderDetails, {
      ...details,
      [nextItem.id]: {
        item: nextItem,
        bom: details[nextItem.id]?.bom ?? [],
        sizes: (payload.sizeAllocations ?? []).map((item) => ({ size: item.sizeLabel, qty: item.percent })),
        colors: (payload.colorAllocations ?? []).map((item) => ({ color: item.colorName, hex: item.hexCode ?? null, qty: item.percent })),
        challans: details[nextItem.id]?.challans ?? [],
      },
    });
    return { item: nextItem };
  }

  const nextDetails = { ...details };
  delete nextDetails[entityId];
  setSnapshot(SNAPSHOT_KEYS.orderDetails, nextDetails);
  return undefined;
}

function applyPlanningMutation(operationType, entityId, payload, bundleId) {
  const snapshot = getSnapshot(SNAPSHOT_KEYS.planningBoard);
  if (!snapshot) return { item: null };

  const order = snapshot.orders.find((item) => item.id === payload.orderId);
  const line = snapshot.lines.find((item) => item.id === payload.lineId);
  const allocationId = operationType === "planning.update" ? entityId : `local-${bundleId}`;
  const nextAllocation = {
    id: allocationId,
    orderId: payload.orderId,
    lineId: payload.lineId,
    poNumber: order?.poNumber ?? "",
    lineName: line?.name ?? "",
    plannedQty: payload.plannedQty,
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: "Active",
    syncState: "pending",
  };
  snapshot.allocations = [...snapshot.allocations.filter((item) => item.id !== allocationId && item.orderId !== payload.orderId), nextAllocation];
  snapshot.orders = snapshot.orders.map((item) => item.id === payload.orderId ? { ...item, status: "Planned", syncState: "pending" } : item);
  setSnapshot(SNAPSHOT_KEYS.planningBoard, snapshot);
  return { item: nextAllocation };
}

function applyInventoryMutation(operationType, entityId, payload, bundleId) {
  const inventory = getSnapshot(SNAPSHOT_KEYS.inventory);
  const procurement = getSnapshot(SNAPSHOT_KEYS.procurementRequests) ?? { items: [] };
  if (!inventory) return { item: null };

  if (operationType === "inventory.adjustment.create") {
    inventory.items = inventory.items.map((item) => item.id === payload.sku ? {
      ...item,
      stock: item.stock + payload.deltaQty,
      syncState: "pending",
    } : item);
    setSnapshot(SNAPSHOT_KEYS.inventory, inventory);
    return { item: inventory.items.find((item) => item.id === payload.sku) ?? null };
  }

  if (operationType === "inventory.procurement.create") {
    const request = {
      id: `local-${bundleId}`,
      materialId: payload.materialId,
      sku: inventory.items.find((item) => item.materialId === payload.materialId)?.id ?? "",
      material: inventory.items.find((item) => item.materialId === payload.materialId)?.name ?? "",
      supplier: inventory.items.find((item) => item.materialId === payload.materialId)?.supplier ?? "",
      shortageQty: inventory.items.find((item) => item.materialId === payload.materialId)?.shortage ?? 0,
      requestedQty: payload.requestedQty,
      note: payload.note,
      status: "Open",
      createdBy: "Desktop",
      createdAt: new Date().toISOString().slice(0, 10),
      syncState: "pending",
    };
    procurement.items = [request, ...procurement.items];
    inventory.items = inventory.items.map((item) => item.materialId === payload.materialId ? { ...item, activeProcurementRequest: request, syncState: "pending" } : item);
    setSnapshot(SNAPSHOT_KEYS.procurementRequests, procurement);
    setSnapshot(SNAPSHOT_KEYS.inventory, inventory);
    return { item: request };
  }

  procurement.items = procurement.items.map((item) => item.id === entityId ? { ...item, ...payload, syncState: "pending" } : item);
  inventory.items = inventory.items.map((item) => item.activeProcurementRequest?.id === entityId ? { ...item, activeProcurementRequest: procurement.items.find((entry) => entry.id === entityId), syncState: "pending" } : item);
  setSnapshot(SNAPSHOT_KEYS.procurementRequests, procurement);
  setSnapshot(SNAPSHOT_KEYS.inventory, inventory);
  return { item: procurement.items.find((item) => item.id === entityId) ?? null };
}

function applyQaMutation(operationType, entityId, payload, bundleId) {
  const qa = getSnapshot(SNAPSHOT_KEYS.qa);
  if (!qa) return { item: null };
  const recordId = operationType === "qa.update" ? entityId : `local-${bundleId}`;
  const inspection = {
    id: recordId,
    inspectedAt: payload.inspectedAt,
    stage: payload.stage,
    orderId: payload.orderId ?? null,
    vendorId: payload.vendorId ?? null,
    lineId: payload.lineId ?? null,
    orderPo: qa.orderOptions.find((item) => item.id === payload.orderId)?.poNumber ?? null,
    vendorName: qa.vendors.find((item) => item.id === payload.vendorId)?.name ?? null,
    lineName: qa.lineOptions.find((item) => item.id === payload.lineId)?.name ?? null,
    checkedQty: payload.checkedQty,
    approvedQty: payload.approvedQty,
    rejectedQty: payload.rejectedQty,
    reworkQty: payload.reworkQty,
    defects: (payload.defects ?? []).map((defect) => ({
      defectTypeId: defect.defectTypeId,
      defectTypeName: qa.defectTypes.find((item) => item.id === defect.defectTypeId)?.name ?? defect.defectTypeId,
      count: defect.count,
    })),
    syncState: "pending",
  };
  qa.inspections = [inspection, ...qa.inspections.filter((item) => item.id !== recordId)];
  qa.summary = {
    checked: qa.summary.checked + (operationType === "qa.update" ? 0 : payload.checkedQty),
    approved: qa.summary.approved + (operationType === "qa.update" ? 0 : payload.approvedQty),
    rejected: qa.summary.rejected + (operationType === "qa.update" ? 0 : payload.rejectedQty),
    rework: qa.summary.rework + (operationType === "qa.update" ? 0 : payload.reworkQty),
  };
  setSnapshot(SNAPSHOT_KEYS.qa, qa);
  return { item: { id: recordId } };
}

function applyDispatchMutation(operationType, entityId, payload, bundleId) {
  const dispatch = getSnapshot(SNAPSHOT_KEYS.dispatch);
  if (!dispatch) return { item: null };
  const target = dispatch.items.find((item) => item.id === payload.orderId || item.latestShipment?.id === entityId || item.shipments?.some((shipment) => shipment.id === entityId));
  if (!target) return { item: null };
  const shipmentId = operationType === "dispatch.update" ? entityId : `local-${bundleId}`;
  const shipment = {
    id: shipmentId,
    dispatchDate: payload.dispatchDate,
    quantity: payload.quantity,
    invoiceNumber: payload.invoiceNumber ?? null,
    status: payload.status ?? "Scheduled",
    syncState: "pending",
  };
  const shipments = [shipment, ...(target.shipments ?? []).filter((item) => item.id !== shipmentId)];
  const dispatched = shipments.filter((item) => item.status !== "Cancelled").reduce((sum, item) => sum + item.quantity, 0);
  const updatedTarget = {
    ...target,
    dispatched,
    remaining: Math.max(0, target.qty - dispatched),
    status: dispatched >= target.qty ? "Dispatched" : "Ready To Dispatch",
    latestShipment: shipment,
    shipments,
    syncState: "pending",
  };
  dispatch.items = dispatch.items.map((item) => item.id === target.id ? updatedTarget : item);
  setSnapshot(SNAPSHOT_KEYS.dispatch, dispatch);
  return { item: updatedTarget };
}

function applyOptimisticMutation(operationType, entityId, payload, bundleId) {
  if (operationType.startsWith("orders.")) return applyOrderMutation(operationType, entityId, payload, bundleId);
  if (operationType.startsWith("planning.")) return applyPlanningMutation(operationType, entityId, payload, bundleId);
  if (operationType.startsWith("inventory.")) return applyInventoryMutation(operationType, entityId, payload, bundleId);
  if (operationType.startsWith("qa.")) return applyQaMutation(operationType, entityId, payload, bundleId);
  if (operationType.startsWith("dispatch.")) return applyDispatchMutation(operationType, entityId, payload, bundleId);
  return { item: null };
}

async function getAuthHeaders() {
  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const cookies = await session.defaultSession.cookies.get({ url: apiBaseUrl });
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  return {
    "Content-Type": "application/json",
    "x-desktop-client-version": DESKTOP_CLIENT_VERSION,
    "x-desktop-device-id": getDeviceId(),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };
}

async function performAuthorizedJson(url, init = {}) {
  const response = await fetch(`${DEFAULT_API_BASE_URL}${url}`, {
    ...init,
    headers: {
      ...(await getAuthHeaders()),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.message ?? "Request failed");
    error.code = payload?.code;
    error.details = payload?.details;
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function pushPendingBundles() {
  if (runtimeStatus.accessState === "restricted" || runtimeStatus.accessState === "locked") {
    return;
  }
  const rows = db.prepare("SELECT * FROM sync_bundles WHERE status IN ('pending', 'failed') ORDER BY created_at ASC LIMIT 25").all();
  if (!rows.length) return;
  const bundles = rows.map((row) => {
    const mutation = db.prepare("SELECT * FROM outbox_mutations WHERE bundle_id = ?").get(row.bundle_id);
    return {
      bundleId: row.bundle_id,
      deviceId: row.device_id,
      workspaceId: row.workspace_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operationType: row.operation_type,
      createdAt: row.created_at,
      mutations: [{
        mutationId: mutation.mutation_id,
        bundleId: mutation.bundle_id,
        deviceId: mutation.device_id,
        workspaceId: mutation.workspace_id,
        entityType: mutation.entity_type,
        entityId: mutation.entity_id,
        operationType: mutation.operation_type,
        payload: JSON.parse(mutation.payload),
        baseVersion: mutation.base_version,
        createdAt: mutation.created_at,
      }],
    };
  });

  rows.forEach((row) => {
    db.prepare("UPDATE sync_bundles SET status = 'syncing', updated_at = ? WHERE bundle_id = ?").run(new Date().toISOString(), row.bundle_id);
    db.prepare("UPDATE outbox_mutations SET status = 'syncing', updated_at = ? WHERE bundle_id = ?").run(new Date().toISOString(), row.bundle_id);
  });

  const result = await performAuthorizedJson("/api/sync/push", {
    method: "POST",
    body: JSON.stringify({ bundles }),
  });

  result.results.forEach((bundleResult) => {
    const now = new Date().toISOString();
    const status = bundleResult.status === "synced"
      ? "synced"
      : bundleResult.status === "conflict"
        ? "conflict"
        : "failed";
    db.prepare("UPDATE sync_bundles SET status = ?, error_code = ?, error_message = ?, retry_count = CASE WHEN ? = 'failed' THEN retry_count + 1 ELSE retry_count END, updated_at = ? WHERE bundle_id = ?")
      .run(status, bundleResult.code ?? null, bundleResult.message ?? null, status, now, bundleResult.bundleId);
    db.prepare("UPDATE outbox_mutations SET status = ?, updated_at = ? WHERE bundle_id = ?").run(status, now, bundleResult.bundleId);

    if (status === "conflict") {
      const existing = db.prepare("SELECT COUNT(*) AS count FROM sync_conflicts WHERE bundle_id = ?").get(bundleResult.bundleId).count;
      if (!existing) {
        db.prepare(`
          INSERT INTO sync_conflicts (id, device_id, bundle_id, mutation_id, entity_type, entity_id, conflict_type, summary, local_snapshot, server_snapshot, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          getDeviceId(),
          bundleResult.bundleId,
          bundleResult.mutationResults[0]?.mutationId ?? bundleResult.bundleId,
          rows.find((row) => row.bundle_id === bundleResult.bundleId)?.entity_type ?? "unknown",
          rows.find((row) => row.bundle_id === bundleResult.bundleId)?.entity_id ?? "unknown",
          bundleResult.code ?? "SYNC_CONFLICT",
          bundleResult.message ?? "Sync conflict",
          rows.find((row) => row.bundle_id === bundleResult.bundleId)?.payload ?? "{}",
          "{}",
          now,
        );
      }
    }

    const deadLetterRow = db.prepare("SELECT retry_count, entity_type, entity_id FROM sync_bundles WHERE bundle_id = ?").get(bundleResult.bundleId);
    if (status === "failed" && Number(deadLetterRow.retry_count) >= 3) {
      db.prepare("UPDATE sync_bundles SET status = 'dead_letter', updated_at = ? WHERE bundle_id = ?").run(now, bundleResult.bundleId);
      db.prepare(`
        INSERT INTO sync_dead_letters (id, bundle_id, entity_type, entity_id, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), bundleResult.bundleId, deadLetterRow.entity_type, deadLetterRow.entity_id, bundleResult.message ?? "Sync failed repeatedly", now);
    }
  });
}

async function pullLatestSnapshots(forceBootstrap = false) {
  const checkpointId = getCheckpointId();
  const query = new URLSearchParams();
  if (checkpointId) query.set("checkpointId", checkpointId);
  if (forceBootstrap || !checkpointId) query.set("bootstrap", "1");
  const result = await performAuthorizedJson(`/api/sync/pull?${query.toString()}`);
  if (result.snapshots) {
    setSnapshots(result.snapshots);
  }
  setCheckpointId(result.checkpointId);
  setClientState("rebuildRequired", Boolean(result.rebuildState?.required));
  setClientState("accessState", result.entitlement?.state ?? "valid");
}

let isSyncing = false;

async function runSyncNow() {
  if (isSyncing) {
    return refreshRuntimeStatus({ state: "syncing" });
  }

  isSyncing = true;
  const runId = recordSyncRun("running");
  refreshRuntimeStatus({ state: "syncing", lastSyncError: null });

  try {
    await pushPendingBundles();
    await pullLatestSnapshots(false);
    recordSyncRun("ok", null, true, runId);
    return refreshRuntimeStatus({
      online: true,
      state: getClientState("rebuildRequired") ? "rebuild_required" : "idle",
      accessState: getClientState("accessState") ?? "valid",
      lastSyncAt: new Date().toISOString(),
      lastSyncError: null,
    });
  } catch (error) {
    recordSyncRun("failed", error.message, true, runId);
    return refreshRuntimeStatus({
      online: false,
      state: getClientState("rebuildRequired") ? "rebuild_required" : "error",
      accessState: getClientState("accessState") ?? "valid",
      lastSyncError: error.message,
    });
  } finally {
    isSyncing = false;
  }
}

function buildDiagnostics() {
  const oldestPending = db.prepare("SELECT created_at FROM sync_bundles WHERE status IN ('pending', 'failed', 'syncing') ORDER BY created_at ASC LIMIT 1").get();
  const recentRuns = db.prepare("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 10").all();
  const conflicts = db.prepare("SELECT * FROM sync_conflicts ORDER BY created_at DESC LIMIT 20").all();
  const deadLetters = db.prepare("SELECT * FROM sync_dead_letters ORDER BY created_at DESC LIMIT 20").all();
  const counts = getBundleCounts();

  return {
    deviceId: getDeviceId(),
    checkpointId: getCheckpointId(),
    rebuildRequired: Boolean(getClientState("rebuildRequired")),
    pendingBundles: counts.pending + counts.syncing,
    failedBundles: counts.failed,
    syncedBundles: counts.synced,
    deadLetters: counts.dead_letter,
    conflictCount: conflicts.length,
    oldestPendingBundleAgeMinutes: oldestPending
      ? Math.round((Date.now() - new Date(oldestPending.created_at).getTime()) / 60000)
      : null,
    lastSyncAt: runtimeStatus.lastSyncAt,
    lastSyncError: runtimeStatus.lastSyncError,
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
      localSnapshot: JSON.parse(row.local_snapshot),
      serverSnapshot: JSON.parse(row.server_snapshot),
      createdAt: row.created_at,
    })),
    deadLetterItems: deadLetters.map((row) => ({
      bundleId: row.bundle_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reason: row.reason,
      createdAt: row.created_at,
    })),
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("desktop:get-sync-status", async () => refreshRuntimeStatus());
ipcMain.handle("desktop:run-sync-now", async () => runSyncNow());
ipcMain.handle("desktop:get-diagnostics", async () => buildDiagnostics());
ipcMain.handle("desktop:export-diagnostics", async () => {
  const filePath = path.join(getUserDataPath(), `sync-diagnostics-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(buildDiagnostics(), null, 2));
  return { path: filePath };
});
ipcMain.handle("desktop:export-backup", async () => {
  const filePath = path.join(getUserDataPath(), `offline-backup-${Date.now()}.db`);
  fs.copyFileSync(getDatabasePath(), filePath);
  return { path: filePath };
});
ipcMain.handle("desktop:retry-failed-bundles", async () => {
  db.prepare("UPDATE sync_bundles SET status = 'pending', updated_at = ? WHERE status = 'failed'").run(new Date().toISOString());
  return runSyncNow();
});
ipcMain.handle("desktop:rebuild-cache", async () => {
  db.prepare("DELETE FROM local_snapshots").run();
  db.prepare("DELETE FROM pull_checkpoints").run();
  setClientState("checkpointId", null);
  setClientState("rebuildRequired", false);
  await pullLatestSnapshots(true);
  return refreshRuntimeStatus({ state: "idle" });
});
ipcMain.handle("desktop:query-snapshot", async (_event, resource, params = {}) => {
  if (resource === SNAPSHOT_KEYS.ordersList) {
    const snapshot = getSnapshot(resource);
    return snapshot ? { items: filterOrders(snapshot.items ?? [], params) } : null;
  }
  if (resource === SNAPSHOT_KEYS.orderDetails) {
    const snapshot = getSnapshot(resource);
    return snapshot?.[params.id] ?? null;
  }
  return getSnapshot(resource);
});
ipcMain.handle("desktop:seed-snapshots", async (_event, snapshots) => {
  setSnapshots(snapshots);
});
ipcMain.handle("desktop:enqueue-mutation", async (_event, mutation) => {
  if (runtimeStatus.accessState === "locked") {
    throw new Error("This desktop is locked and cannot queue offline writes.");
  }
  if (runtimeStatus.accessState === "restricted") {
    throw new Error("This desktop is restricted and currently read-only.");
  }
  const deviceId = getDeviceId();
  const bundleId = randomUUID();
  const mutationId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sync_bundles (bundle_id, device_id, workspace_id, entity_type, entity_id, operation_type, payload, base_version, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    bundleId,
    deviceId,
    WORKSPACE_ID,
    mutation.entityType,
    mutation.entityId,
    mutation.operationType,
    JSON.stringify(mutation.payload),
    mutation.baseVersion ?? null,
    now,
    now,
  );
  db.prepare(`
    INSERT INTO outbox_mutations (mutation_id, bundle_id, device_id, workspace_id, entity_type, entity_id, operation_type, payload, base_version, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    mutationId,
    bundleId,
    deviceId,
    WORKSPACE_ID,
    mutation.entityType,
    mutation.entityId,
    mutation.operationType,
    JSON.stringify(mutation.payload),
    mutation.baseVersion ?? null,
    now,
    now,
  );
  const result = applyOptimisticMutation(mutation.operationType, mutation.entityId, mutation.payload, bundleId);
  refreshRuntimeStatus({ state: runtimeStatus.online ? "idle" : "offline" });
  void runSyncNow();
  return result;
});
ipcMain.handle("desktop:resolve-conflict", async (_event, conflictId, choice, rationale) => {
  await performAuthorizedJson(`/api/sync/conflicts/${conflictId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ choice, rationale }),
  });
  db.prepare("DELETE FROM sync_conflicts WHERE id = ?").run(conflictId);
  return refreshRuntimeStatus();
});
ipcMain.handle("desktop:get-cached-session", async () => getClientState("cachedSession"));
ipcMain.handle("desktop:set-cached-session", async (_event, user) => {
  setClientState("cachedSession", user);
});
ipcMain.handle("desktop:clear-cached-session", async () => {
  setClientState("cachedSession", null);
});

app.whenReady().then(async () => {
  getDeviceId();
  setClientState("accessState", getClientState("accessState") ?? "valid");
  createWindow();
  refreshRuntimeStatus();
  setInterval(() => {
    void runSyncNow();
  }, 120000);
  setTimeout(() => {
    void runSyncNow();
  }, 1500);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
