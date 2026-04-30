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
  colorItems?: Array<{ name: string; hexCode?: string | null }>;
  inUse?: boolean;
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
};

export type InventoryPayload = {
  items: InventoryItem[];
  lowStockCount: number;
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
};

export type ProcurementRequestsPayload = {
  items: ProcurementRequestItem[];
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
  }>;
  orderOptions: Array<{ id: string; poNumber: string }>;
  lineOptions: Array<{ id: string; name: string }>;
  defectTypes: Array<{ id: string; name: string }>;
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
  } | null;
  shipments?: Array<{
    id: string;
    dispatchDate: string;
    quantity: number;
    invoiceNumber?: string | null;
    status: string;
  }>;
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
