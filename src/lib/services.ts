import { api } from "@/lib/api";
import type {
  CalendarPayload,
  MasterBrand,
  MasterBomItem,
  MasterLine,
  MasterMaterial,
  MastersSummaryPayload,
  MasterStyle,
  MasterSupplier,
  MasterVendor,
  InventoryPayload,
  ProcurementRequestsPayload,
  OrderDetailPayload,
  OrderItem,
  OrderOption,
  PlanningBoardPayload,
  ProductionLine,
  ProductionStage,
  QaPayload,
  DispatchPayload,
  DashboardPayload,
  MrpPayload,
  ReportRowsPayload,
  SettingsPayload,
  ReportsPayload,
  VendorDetailPayload,
  VendorListItem,
} from "@/lib/types";

export type OrdersFilters = {
  q?: string;
  status?: string;
  brandId?: string;
  styleId?: string;
};

export async function fetchOrders(filters: OrdersFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return api<{ items: OrderItem[] }>(`/api/orders${query ? `?${query}` : ""}`);
}

export async function fetchOrderOptions() {
  return api<{
    brands: OrderOption[];
    styles: OrderOption[];
  }>("/api/orders/options");
}

export async function createOrder(payload: {
  brandId: string;
  styleId: string;
  poNumber: string;
  seasonCode: string;
  quantity: number;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notes?: string;
  sizeAllocations?: Array<{ sizeLabel: string; percent: number }>;
  colorAllocations?: Array<{ colorName: string; hexCode?: string | null; percent: number }>;
}) {
  return api<{ item: OrderItem }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOrder(id: string, payload: {
  brandId: string;
  styleId: string;
  poNumber: string;
  seasonCode: string;
  quantity: number;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notes?: string;
  sizeAllocations?: Array<{ sizeLabel: string; percent: number }>;
  colorAllocations?: Array<{ colorName: string; hexCode?: string | null; percent: number }>;
}) {
  return api<{ item: OrderItem }>(`/api/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteOrder(id: string) {
  return api<void>(`/api/orders/${id}`, { method: "DELETE" });
}

export async function fetchOrderDetail(id: string) {
  return api<OrderDetailPayload>(`/api/orders/${id}`);
}

export async function fetchPlanningBoard() {
  return api<PlanningBoardPayload>("/api/planning/board");
}

export async function createPlan(payload: {
  orderId: string;
  lineId: string;
  startDate: string;
  endDate: string;
  plannedQty: number;
}) {
  return api<{ item: PlanningBoardPayload["allocations"][number] }>("/api/planning/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePlan(id: string, payload: {
  orderId: string;
  lineId: string;
  startDate: string;
  endDate: string;
  plannedQty: number;
}) {
  return api<{ item: PlanningBoardPayload["allocations"][number] }>(`/api/planning/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchPlanningCalendar(month = "2024-11") {
  return api<CalendarPayload>(`/api/planning/calendar?month=${month}`);
}

export async function fetchProductionStages() {
  return api<{ items: ProductionStage[] }>("/api/production/stages");
}

export async function fetchProductionLines() {
  return api<{ items: ProductionLine[] }>("/api/production/lines");
}

export async function fetchMastersSummary(q = "") {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return api<MastersSummaryPayload>(`/api/masters/summary${query}`);
}

export async function fetchMastersOptions() {
  return api<{
    brands: Array<{ id: string; name: string; code: string }>;
    suppliers: Array<{ id: string; name: string; code: string }>;
    styles: Array<{ id: string; code: string; name: string; brandId: string }>;
    materials: Array<{ id: string; sku: string; name: string; supplierId?: string | null }>;
  }>("/api/masters/options");
}

export async function createBrand(payload: { code: string; name: string; countryCode: string }) {
  return api<{ item: MasterBrand }>("/api/masters/brands", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBrand(id: string, payload: { code: string; name: string; countryCode: string }) {
  return api<{ item: MasterBrand }>(`/api/masters/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBrand(id: string) {
  return api<void>(`/api/masters/brands/${id}`, { method: "DELETE" });
}

export async function createSupplier(payload: { code: string; name: string; defaultMaterial: string; leadTimeDays: number }) {
  return api<{ item: MasterSupplier }>("/api/masters/suppliers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSupplier(id: string, payload: { code: string; name: string; defaultMaterial: string; leadTimeDays: number }) {
  return api<{ item: MasterSupplier }>(`/api/masters/suppliers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSupplier(id: string) {
  return api<void>(`/api/masters/suppliers/${id}`, { method: "DELETE" });
}

export async function createVendor(payload: { code: string; name: string; process: string; capacityPerDay: number; status: "ACTIVE" | "INACTIVE" }) {
  return api<{ item: MasterVendor }>("/api/masters/vendors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVendor(id: string, payload: { code: string; name: string; process: string; capacityPerDay: number; status: "ACTIVE" | "INACTIVE" }) {
  return api<{ item: MasterVendor }>(`/api/masters/vendors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteVendor(id: string) {
  return api<void>(`/api/masters/vendors/${id}`, { method: "DELETE" });
}

export async function createStyle(payload: { code: string; brandId: string; name: string; gauge: string; yarnDescription: string; sizes: string[]; colors: Array<{ name: string; hexCode?: string | null }> }) {
  return api<{ item: MasterStyle }>("/api/masters/styles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStyle(id: string, payload: { code: string; brandId: string; name: string; gauge: string; yarnDescription: string; sizes: string[]; colors: Array<{ name: string; hexCode?: string | null }> }) {
  return api<{ item: MasterStyle }>(`/api/masters/styles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStyle(id: string) {
  return api<void>(`/api/masters/styles/${id}`, { method: "DELETE" });
}

export async function createMaterial(payload: {
  sku: string;
  name: string;
  type: "YARN" | "TRIM" | "LABEL" | "PACKING" | "OTHER";
  uom: string;
  stockQty: number;
  allocatedQty: number;
  reorderLevel: number;
  supplierId?: string | null;
}) {
  return api<{ item: MasterMaterial }>("/api/masters/materials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMaterial(id: string, payload: {
  sku: string;
  name: string;
  type: "YARN" | "TRIM" | "LABEL" | "PACKING" | "OTHER";
  uom: string;
  stockQty: number;
  allocatedQty: number;
  reorderLevel: number;
  supplierId?: string | null;
}) {
  return api<{ item: MasterMaterial }>(`/api/masters/materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteMaterial(id: string) {
  return api<void>(`/api/masters/materials/${id}`, { method: "DELETE" });
}

export async function createBomItem(payload: {
  styleId: string;
  materialId: string;
  quantityPerPiece: number;
  uom: string;
}) {
  return api<{ item: MasterBomItem }>("/api/masters/bom-items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBomItem(id: string, payload: {
  styleId: string;
  materialId: string;
  quantityPerPiece: number;
  uom: string;
}) {
  return api<{ item: MasterBomItem }>(`/api/masters/bom-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBomItem(id: string) {
  return api<void>(`/api/masters/bom-items/${id}`, { method: "DELETE" });
}

export async function createLine(payload: {
  code: string;
  name: string;
  process: string;
  gauge: string;
  machineCount: number;
  isActive: boolean;
}) {
  return api<{ item: MasterLine }>("/api/masters/lines", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLine(id: string, payload: {
  code: string;
  name: string;
  process: string;
  gauge: string;
  machineCount: number;
  isActive: boolean;
}) {
  return api<{ item: MasterLine }>(`/api/masters/lines/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteLine(id: string) {
  return api<void>(`/api/masters/lines/${id}`, { method: "DELETE" });
}

export async function fetchVendors() {
  return api<{ items: VendorListItem[] }>("/api/vendors");
}

export async function fetchVendorDetail(id: string) {
  return api<VendorDetailPayload>(`/api/vendors/${id}`);
}

export async function issueVendorChallan(
  vendorId: string,
  payload: { orderId: string; challanDate: string; outwardQty: number },
) {
  return api<{ item: VendorDetailPayload["challans"][number] }>(`/api/vendors/${vendorId}/challans`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVendorChallan(
  vendorId: string,
  challanId: string,
  payload: { inwardQty: number; rejectedQty: number },
) {
  return api<{ item: VendorDetailPayload["challans"][number] }>(`/api/vendors/${vendorId}/challans/${challanId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchInventory() {
  return api<InventoryPayload>("/api/inventory");
}

export async function createInventoryAdjustment(payload: { sku: string; deltaQty: number; reason: string }) {
  return api<{ item: InventoryPayload["items"][number] }>("/api/inventory/adjustments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchProcurementRequests() {
  return api<ProcurementRequestsPayload>("/api/inventory/procurement-requests");
}

export async function createProcurementRequest(payload: { materialId: string; requestedQty: number; note: string }) {
  return api<{ item: ProcurementRequestsPayload["items"][number] }>("/api/inventory/procurement-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProcurementRequest(id: string, payload: { requestedQty?: number; note?: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED" }) {
  return api<{ item: ProcurementRequestsPayload["items"][number] }>(`/api/inventory/procurement-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchQa() {
  return api<QaPayload>("/api/qa");
}

export async function createQaInspection(payload: {
  inspectedAt: string;
  orderId?: string | null;
  vendorId?: string | null;
  lineId?: string | null;
  stage: string;
  checkedQty: number;
  approvedQty: number;
  rejectedQty: number;
  reworkQty: number;
  defects: Array<{ defectTypeId: string; count: number }>;
}) {
  return api<{ item: { id: string } }>("/api/qa/inspections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateQaInspection(id: string, payload: {
  inspectedAt: string;
  orderId?: string | null;
  vendorId?: string | null;
  lineId?: string | null;
  stage: string;
  checkedQty: number;
  approvedQty: number;
  rejectedQty: number;
  reworkQty: number;
  defects: Array<{ defectTypeId: string; count: number }>;
}) {
  return api<{ item: { id: string } }>(`/api/qa/inspections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchDispatch() {
  return api<DispatchPayload>("/api/dispatch");
}

export async function createShipment(payload: {
  orderId: string;
  dispatchDate: string;
  quantity: number;
  invoiceNumber?: string;
  status?: "READY" | "SCHEDULED" | "DISPATCHED" | "CANCELLED";
}) {
  return api<{ item: DispatchPayload["items"][number] }>("/api/dispatch/shipments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateShipment(id: string, payload: {
  dispatchDate: string;
  quantity: number;
  invoiceNumber?: string;
  status?: "READY" | "SCHEDULED" | "DISPATCHED" | "CANCELLED";
}) {
  return api<{ item: DispatchPayload["items"][number] }>(`/api/dispatch/shipments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchSettings() {
  return api<SettingsPayload>("/api/settings");
}

export async function updateDepartment(code: string, payload: { head: string; staff: number; lines: number }) {
  return api<{ item: SettingsPayload["departments"][number] }>(`/api/settings/departments/${code}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateShift(code: string, payload: { supervisor: string; headcount: number }) {
  return api<{ item: SettingsPayload["shifts"][number] }>(`/api/settings/shifts/${code}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateSettingsUser(employeeCode: string, payload: { role: string; status: "ACTIVE" | "INACTIVE"; departmentCode?: string | null; shiftCode?: string | null }) {
  return api<{ item: SettingsPayload["users"][number] }>(`/api/settings/users/${employeeCode}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchDashboard() {
  return api<DashboardPayload>("/api/dashboard");
}

export async function fetchReports() {
  return api<ReportsPayload>("/api/reports");
}

export async function fetchReportRows(slug: string) {
  return api<ReportRowsPayload>(`/api/reports/${slug}`);
}

export async function fetchMrp() {
  return api<MrpPayload>("/api/mrp");
}
