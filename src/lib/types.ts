export type Role =
  | "Admin"
  | "Factory Manager"
  | "Production Planner"
  | "Merchandiser"
  | "QA Manager"
  | "Store Manager"
  | "Line Supervisor"
  | "Vendor Manager"
  | "Dispatch Manager";

export type AuthUser = {
  id: string;
  employeeCode?: string;
  name: string;
  email: string;
  role: Role;
  actualRole?: Role;
  effectiveRole?: Role;
  impersonatedRole?: Role | null;
  canImpersonate?: boolean;
};

export type OrderItem = {
  id: string;
  poNumber: string;
  brandId: string;
  brand: string;
  styleId: string;
  style: string;
  styleName: string;
  season: string;
  qty: number;
  delivered: number;
  due: string;
  status: string;
  priority: string;
  progress: number;
  syncState?: "synced" | "pending" | "conflict";
};

export type OrderOption = {
  id: string;
  name: string;
  code: string;
  country?: string;
  brandId?: string;
  sizes?: string[];
  colors?: Array<{ name: string; hexCode?: string | null }>;
};

export type OrderDetailPayload = {
  item: OrderItem;
  bom: Array<{
    id: string;
    item: string;
    type: string;
    qty: number;
    uom: string;
    supplier: string | null;
  }>;
  sizes: Array<{ size: string; qty: number }>;
  colors: Array<{ color: string; hex?: string | null; qty: number }>;
  challans: Array<{
    id: string;
    challanNumber: string;
    date: string;
    vendor: string;
    process: string;
    po: string;
    outQty: number;
    inQty: number;
    rejected: number;
    status: string;
  }>;
  techPack?: StyleTechPackPayload;
};

export type PlanningLine = {
  id: string;
  name: string;
  gauge: string;
  machines: number;
  efficiency: number;
  output: number;
};

export type PlanningBoardPayload = {
  lines: PlanningLine[];
  orders: Array<{
    id: string;
    poNumber: string;
    brand: string;
    styleName: string;
    season: string;
    qty: number;
    due: string;
    status: string;
    priority: string;
    progress: number;
  }>;
  allocations: Array<{
    id: string;
    orderId: string;
    lineId: string;
    poNumber: string;
    lineName: string;
    plannedQty: number;
    startDate: string;
    endDate: string;
    status: string;
  }>;
};

export type CalendarPayload = {
  monthLabel: string;
  days: Array<{ day: number; target: number; actual: number; status: "ok" | "warn" | "miss" }>;
  lines: Array<{
    id: string;
    name: string;
    gauge: string;
    fill: number;
    allocations: Array<{ poNumber: string; width: number }>;
  }>;
};

export type ProductionStage = {
  stage: string;
  planned: number;
  actual: number;
  wip: number;
  rejected: number;
  pending: number;
};

export type ProductionLine = {
  id: string;
  name: string;
  gauge: string;
  machines: number;
  output: number;
  efficiency: number;
  status: string;
};

export type ProductionEntryItem = {
  id: string;
  metricDate: string;
  lineId: string;
  lineName: string;
  orderId?: string | null;
  poNumber?: string | null;
  shiftId?: string | null;
  shiftName?: string | null;
  stage: string;
  plannedQty: number;
  actualQty: number;
  rejectedQty: number;
  downtimeMinutes: number;
  downtimeReasonId?: string | null;
  downtimeReason?: string | null;
  remarks: string;
};

export type ProductionEntriesPayload = {
  items: ProductionEntryItem[];
  downtimeReasons: Array<{ id: string; code: string; label: string }>;
  shifts: Array<{ id: string; name: string }>;
  orders: Array<{ id: string; poNumber: string }>;
  lines: Array<{ id: string; name: string }>;
};

export type MasterBrand = {
  id: string;
  code: string;
  name: string;
  country: string;
  activeOrders: number;
};

export type MasterSupplier = {
  id: string;
  code: string;
  name: string;
  material: string;
  lead: number;
};

export type MasterVendor = {
  id: string;
  code: string;
  name: string;
  process: string;
  capacity: number;
  pending: number;
  otd: number;
  quality: number;
  status: string;
};

export type MasterStyle = {
  id: string;
  code: string;
  brand: string;
  brandId: string;
  name: string;
  gauge: string;
  yarn: string;
  sizes: string[];
  colors: number;
  colorItems?: Array<{
    name: string;
    hexCode?: string | null;
    pantoneCode?: string;
    threadCode?: string;
    notes?: string;
  }>;
  inUse?: boolean;
  sampleImageUrl?: string | null;
  assetCount?: number;
  sampleStatus?: string | null;
  measurementCount?: number;
  threadSpecCount?: number;
};

export type FileAssetItem = {
  id: string;
  entityType: "STYLE" | "STYLE_SAMPLE" | "ORDER";
  entityId: string;
  kind: "SAMPLE_IMAGE" | "REFERENCE_IMAGE" | "TECH_PACK" | "ATTACHMENT";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
  createdAt: string;
};

export type StyleSampleItem = {
  id: string;
  sampleType: "PROTO" | "FIT" | "SIZE_SET" | "PP" | "SHIPMENT";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISED";
  notes: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  assets: FileAssetItem[];
};

export type StyleMeasurementSpecItem = {
  id?: string;
  sizeLabel: string;
  measurementPoint: string;
  targetValue: number;
  tolerancePlus: number;
  toleranceMinus: number;
  unit: string;
};

export type StyleThreadSpecItem = {
  id?: string;
  materialName: string;
  countSpec: string;
  colorRef: string;
  supplierId?: string | null;
  materialId?: string | null;
  processNotes: string;
  sortOrder: number;
};

export type StyleColorwayItem = {
  id?: string;
  name: string;
  hexCode?: string | null;
  pantoneCode?: string;
  threadCode?: string;
  notes?: string;
};

export type StyleTechPackPayload = {
  styleId: string;
  assets: FileAssetItem[];
  samples: StyleSampleItem[];
  measurements: StyleMeasurementSpecItem[];
  threadSpecs: StyleThreadSpecItem[];
  colorways: StyleColorwayItem[];
};

export type MasterMaterial = {
  id: string;
  sku: string;
  name: string;
  type: string;
  uom: string;
  stock: number;
  allocated: number;
  reorderLevel: number;
  supplier: string;
  supplierId?: string | null;
};

export type MasterBomItem = {
  id: string;
  styleId: string;
  styleCode: string;
  materialId: string;
  materialSku: string;
  materialName: string;
  supplier: string | null;
  qty: number;
  uom: string;
};

export type MasterLine = {
  id: string;
  code: string;
  name: string;
  process: string;
  gauge: string;
  machines: number;
  active: boolean;
};

export type MastersSummaryPayload = {
  brands: MasterBrand[];
  suppliers: MasterSupplier[];
  vendors: MasterVendor[];
  styles: MasterStyle[];
  materials: MasterMaterial[];
  bomItems: MasterBomItem[];
  lines: MasterLine[];
};

export type VendorListItem = {
  id: string;
  code: string;
  name: string;
  process: string;
  capacity: number;
  pending: number;
  otd: number;
  quality: number;
  status: string;
};

export type VendorDetailPayload = {
  item: VendorListItem;
  utilisation: number;
  openCapaCount?: number;
  qualityRisk?: string;
  trend: Array<{
    wk: string;
    otd: number;
    qty: number;
    quality: number;
  }>;
  scorecard: Array<{
    k: string;
    v: number;
  }>;
  challans: Array<{
    id: string;
    challanNumber: string;
    date: string;
    po: string;
    orderId: string;
    outQty: number;
    inQty: number;
    rejected: number;
    status: string;
  }>;
  orderOptions: Array<{
    id: string;
    poNumber: string;
  }>;
};

export type InventoryItem = {
  id: string;
  materialId: string;
  name: string;
  type: string;
  uom: string;
  stock: number;
  min: number;
  allocated: number;
  supplier: string;
  shortage: number;
  activeProcurementRequest?: ProcurementRequestItem | null;
  syncState?: "synced" | "pending" | "conflict";
};

export type InventoryPayload = {
  items: InventoryItem[];
  lowStockCount: number;
  purchaseOrders?: ProcurementPurchaseOrderItem[];
};

export type ProcurementRequestItem = {
  id: string;
  materialId: string;
  sku: string;
  material: string;
  supplier: string;
  shortageQty: number;
  requestedQty: number;
  note: string;
  status: string;
  createdBy: string;
  createdAt: string;
  syncState?: "synced" | "pending" | "conflict";
};

export type ProcurementRequestsPayload = {
  items: ProcurementRequestItem[];
};

export type ProcurementPurchaseOrderItem = {
  id: string;
  poNumber: string;
  procurementRequestId?: string | null;
  supplierId: string;
  supplier: string;
  materialId?: string | null;
  material?: string | null;
  sku?: string | null;
  requestedQty: number;
  orderedQty: number;
  receivedQty: number;
  balanceQty: number;
  uom: string;
  status: string;
  expectedDate?: string | null;
  note: string;
  receipts: number;
};

export type ProcurementPurchaseOrdersPayload = {
  items: ProcurementPurchaseOrderItem[];
};

export type QaPayload = {
  summary: {
    checked: number;
    approved: number;
    rejected: number;
    rework: number;
  };
  defects: Array<{
    type: string;
    count: number;
    pct: number;
  }>;
  vendors: Array<{
    id: string;
    name: string;
    process: string;
    quality: number;
    openCapaCount?: number;
  }>;
  inspections: Array<{
    id: string;
    inspectedAt: string;
    stage: string;
    orderId?: string | null;
    vendorId?: string | null;
    lineId?: string | null;
    orderPo: string | null;
    vendorName: string | null;
    lineName: string | null;
    checkedQty: number;
    approvedQty: number;
    rejectedQty: number;
    reworkQty: number;
    defects: Array<{ defectTypeId: string; defectTypeName: string; count: number }>;
    syncState?: "synced" | "pending" | "conflict";
  }>;
  orderOptions: Array<{ id: string; poNumber: string }>;
  lineOptions: Array<{ id: string; name: string }>;
  defectTypes: Array<{ id: string; name: string }>;
  capaItems: Array<{
    id: string;
    inspectionId?: string | null;
    vendorId?: string | null;
    vendorName?: string | null;
    orderId?: string | null;
    orderPo?: string | null;
    lineId?: string | null;
    lineName?: string | null;
    title: string;
    rootCause: string;
    ownerName: string;
    dueDate: string;
    status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  }>;
};

export type DispatchItem = {
  id: string;
  poNumber: string;
  brand: string;
  styleName: string;
  qty: number;
  dispatched: number;
  remaining: number;
  due: string;
  status: string;
  latestShipment?: {
    id: string;
    dispatchDate: string;
    quantity: number;
    invoiceNumber?: string | null;
    status: string;
    syncState?: "synced" | "pending" | "conflict";
  } | null;
  shipments?: Array<{
    id: string;
    dispatchDate: string;
    quantity: number;
    invoiceNumber?: string | null;
    status: string;
    syncState?: "synced" | "pending" | "conflict";
  }>;
  syncState?: "synced" | "pending" | "conflict";
};

export type DispatchPayload = {
  items: DispatchItem[];
};

export type SettingsPayload = {
  departments: Array<{
    id: string;
    name: string;
    head: string;
    staff: number;
    lines: number;
  }>;
  shifts: Array<{
    id: string;
    name: string;
    start: string;
    end: string;
    supervisor: string;
    headcount: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    last: string;
    departmentCode?: string | null;
    shiftCode?: string | null;
  }>;
  auditLog: Array<{
    id: string;
    ts: string;
    actor: string;
    action: string;
    target: string;
    module: string;
  }>;
  desktopDevices?: Array<{
    id: string;
    clientVersion: string;
    workspaceId: string;
    status: string;
    rebuildRequired: boolean;
    lastSeenAt: string;
    conflicts: number;
  }>;
};

export type DashboardPayload = {
  kpis: {
    totalOrders: number;
    unitsPlanned: number;
    unitsInProduction: number;
    unitsCompleted: number;
    lineEfficiency: number;
    otif: number;
    rejectionPct: number;
    delayedOrders: number;
  };
  dailyTrend: Array<{ day: string; planned: number; actual: number; rejected: number }>;
  qaDefects: Array<{ type: string; count: number; pct: number }>;
  monthlyCapacity: Array<{ month: string; capacity: number; used: number }>;
  brandSummary: Array<{ brand: string; units: number }>;
  productionStages: Array<{ stage: string; planned: number; actual: number; wip: number; rejected: number }>;
  alerts: Array<{ id: string; severity: string; title: string; time: string; module: string }>;
  vendors: Array<{ id: string; name: string; process: string; pending: number; otd: number; quality: number }>;
  orders: Array<{ id: string; brand: string; qty: number; status: string }>;
};

export type SearchPayload = {
  groups: Array<{
    module: string;
    items: Array<{ id: string; title: string; subtitle: string; href: string }>;
  }>;
};

export type NotificationsPayload = {
  count: number;
  items: Array<{ id: string; severity: string; title: string; module: string; time: string; href: string }>;
};

export type ReportsPayload = {
  items: Array<{
    slug: string;
    name: string;
    desc: string;
    category: string;
    rows: number;
    downloadUrl: string;
    pdfUrl: string;
  }>;
};

export type ReportRowsPayload = {
  slug: string;
  name: string;
  category: string;
  rows: Array<Record<string, string | number | boolean | null>>;
};

export type MrpPayload = {
  items: Array<{
    materialId: string;
    sku: string;
    material: string;
    supplier: string;
    required: number;
    free: number;
    shortage: number;
    activeProcurementRequest?: {
      id: string;
      status: string;
      requestedQty: number;
      note: string;
    } | null;
  }>;
};

export type CheckpointStatus = "ok" | "unknown_checkpoint" | "expired_checkpoint" | "rebuild_required";

export type RebuildState = {
  required: boolean;
  reason?: string | null;
};

export type DesktopClientInfo = {
  deviceId: string;
  clientVersion: string;
  workspaceId: string;
};

export type OutboxMutation = {
  mutationId: string;
  bundleId: string;
  deviceId: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  payload: unknown;
  baseVersion?: string | null;
  createdAt: string;
};

export type SyncBundle = {
  bundleId: string;
  deviceId: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  createdAt: string;
  mutations: OutboxMutation[];
};

export type MutationResult = {
  mutationId: string;
  status: "synced" | "conflict" | "failed" | "skipped";
  code?: string;
  message?: string;
};

export type BundleResult = {
  bundleId: string;
  status: "synced" | "conflict" | "failed" | "skipped";
  code?: string;
  message?: string;
  mutationResults: MutationResult[];
};

export type ConflictRecord = {
  id: string;
  deviceId: string;
  bundleId: string;
  mutationId: string;
  entityType: string;
  entityId: string;
  conflictType: string;
  summary: string;
  localSnapshot: unknown;
  serverSnapshot: unknown;
  chosenAction?: string | null;
  rationale?: string | null;
  createdAt: string;
};

export type DiagnosticsSnapshot = {
  deviceId: string;
  checkpointId: string | null;
  rebuildRequired: boolean;
  pendingBundles: number;
  failedBundles: number;
  syncedBundles: number;
  deadLetters: number;
  conflictCount: number;
  oldestPendingBundleAgeMinutes: number | null;
  lastSyncAt: string | null;
  lastSyncError?: string | null;
  recentRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string | null;
    message?: string | null;
  }>;
  conflicts: ConflictRecord[];
  deadLetterItems: Array<{
    bundleId: string;
    entityType: string;
    entityId: string;
    reason: string;
    createdAt: string;
  }>;
};

export type PushBundlesRequest = {
  bundles: SyncBundle[];
};

export type PushBundlesResponse = {
  results: BundleResult[];
};

export type PullSyncRequest = {
  checkpointId?: string | null;
  scope?: string[];
};

export type PullSyncResponse = {
  checkpointStatus: CheckpointStatus;
  checkpointId: string | null;
  entitlement: {
    state: "valid" | "valid_but_recheck_due" | "grace" | "restricted" | "locked";
  };
  rebuildState: RebuildState;
  snapshots?: Partial<Record<string, unknown>>;
};

export type OutdatedClientResponse = {
  code: "CLIENT_TOO_OLD";
  message: string;
  minimumVersion: string;
  currentVersion: string;
};

export type DesktopSyncStatus = {
  isDesktop: boolean;
  online: boolean;
  state: "idle" | "syncing" | "offline" | "error" | "rebuild_required";
  accessState?: "valid" | "valid_but_recheck_due" | "grace" | "restricted" | "locked";
  pendingBundles: number;
  failedBundles: number;
  conflictCount: number;
  deadLetters: number;
  lastSyncAt: string | null;
  lastSyncError?: string | null;
  rebuildRequired: boolean;
  deviceId?: string;
};

export type ConflictResolutionChoice = "keep_local" | "keep_server" | "dismiss";
