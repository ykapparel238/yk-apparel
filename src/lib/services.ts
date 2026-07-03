import { api } from "@/lib/api";
import {
  createOrderFromRepository,
  deleteOrderFromRepository,
  fetchOrderDetailFromRepository,
  fetchOrderOptionsFromRepository,
  fetchOrdersFromRepository,
  type OrdersFilters,
  updateOrderFromRepository,
} from "@/lib/ordersRepository";
import {
  desktopResources,
  mutateDesktopOrRemote,
  readDesktopSnapshot,
  readDesktopOrRemote,
} from "@/lib/desktopOfflineRepository";
import { withWorkflowChangeRequest } from "@/lib/changeRequests";
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
  FileAssetItem,
  InventoryPayload,
  ProcurementRequestsPayload,
  ProcurementPurchaseOrdersPayload,
  OrderDetailPayload,
  PlanningBoardPayload,
  ProductionEntriesPayload,
  ProductionLine,
  ProductionStage,
  QaPayload,
  DispatchPayload,
  DashboardPayload,
  MrpPayload,
  ReportRowsPayload,
  SettingsPayload,
  NotificationsPayload,
  SearchPayload,
  StyleColorwayItem,
  StyleMeasurementSpecItem,
  StyleSampleItem,
  StyleTechPackPayload,
  StyleThreadSpecItem,
  ReportsPayload,
  VendorDetailPayload,
  VendorListItem,
} from "@/lib/types";

export async function fetchOrders(filters: OrdersFilters) {
  return readDesktopOrRemote(
    desktopResources.ordersList,
    () => fetchOrdersFromRepository(filters),
    (payload) => ({ [desktopResources.ordersList]: payload }),
    filters,
  );
}

export async function fetchOrderOptions() {
  return readDesktopOrRemote(
    desktopResources.ordersOptions,
    fetchOrderOptionsFromRepository,
    (payload) => ({ [desktopResources.ordersOptions]: payload }),
  );
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
  return mutateDesktopOrRemote(
    {
      entityType: "order",
      entityId: payload.poNumber,
      operationType: "orders.create",
      payload,
    },
    () => createOrderFromRepository(payload),
  );
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
  const detail = await readDesktopSnapshot<OrderDetailPayload>(desktopResources.orderDetails, { id });
  return mutateDesktopOrRemote(
    {
      entityType: "order",
      entityId: id,
      operationType: "orders.update",
      payload,
      baseVersion: (detail?.item as OrderItem & { syncVersion?: string } | undefined)?.syncVersion ?? null,
    },
    () => updateOrderFromRepository(id, payload),
  );
}

export async function deleteOrder(id: string) {
  const detail = await readDesktopSnapshot<OrderDetailPayload>(desktopResources.orderDetails, { id });
  return mutateDesktopOrRemote(
    {
      entityType: "order",
      entityId: id,
      operationType: "orders.delete",
      payload: { id },
      baseVersion: (detail?.item as OrderItem & { syncVersion?: string } | undefined)?.syncVersion ?? null,
    },
    () => deleteOrderFromRepository(id),
  );
}

export async function fetchOrderDetail(id: string) {
  return readDesktopOrRemote(
    desktopResources.orderDetails,
    () => fetchOrderDetailFromRepository(id),
    (payload) => ({
      [desktopResources.orderDetails]: {
        [id]: payload,
      },
    }),
    { id },
  );
}

export async function fetchPlanningBoard() {
  return readDesktopOrRemote(
    desktopResources.planningBoard,
    () => api<PlanningBoardPayload>("/api/planning/board"),
    (payload) => ({ [desktopResources.planningBoard]: payload }),
  );
}

export async function createPlan(payload: {
  orderId: string;
  lineId: string;
  startDate: string;
  endDate: string;
  plannedQty: number;
}) {
  return mutateDesktopOrRemote(
    {
      entityType: "planning",
      entityId: payload.orderId,
      operationType: "planning.create",
      payload,
      baseVersion: payload.orderId,
    },
    () => api<{ item: PlanningBoardPayload["allocations"][number] }>("/api/planning/plans", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function updatePlan(id: string, payload: {
  orderId: string;
  lineId: string;
  startDate: string;
  endDate: string;
  plannedQty: number;
}) {
  const board = await readDesktopSnapshot<PlanningBoardPayload>(desktopResources.planningBoard);
  const allocation = board?.allocations.find((item) => item.id === id) as (PlanningBoardPayload["allocations"][number] & { syncVersion?: string }) | undefined;
  return mutateDesktopOrRemote(
    {
      entityType: "planning",
      entityId: id,
      operationType: "planning.update",
      payload,
      baseVersion: allocation?.syncVersion ?? null,
    },
    () => withWorkflowChangeRequest(
      () => api<{ item: PlanningBoardPayload["allocations"][number] }>(`/api/planning/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
      { module: "planning", entityType: "ProductionPlan", entityId: id, operation: "update" },
      payload,
    ),
  );
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
    styles: Array<{
      id: string;
      code: string;
      name: string;
      brandId: string;
      sizes?: string[];
      colors?: Array<{ name: string; hexCode?: string | null }>;
    }>;
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

export async function createStyle(payload: {
  code: string;
  brandId: string;
  name: string;
  gauge: string;
  yarnDescription: string;
  sizes: string[];
  colors: Array<{ name: string; hexCode?: string | null; pantoneCode?: string; threadCode?: string; notes?: string }>;
}) {
  return api<{ item: MasterStyle }>("/api/masters/styles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStyle(id: string, payload: {
  code: string;
  brandId: string;
  name: string;
  gauge: string;
  yarnDescription: string;
  sizes: string[];
  colors: Array<{ name: string; hexCode?: string | null; pantoneCode?: string; threadCode?: string; notes?: string }>;
}) {
  return api<{ item: MasterStyle }>(`/api/masters/styles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStyle(id: string) {
  return api<void>(`/api/masters/styles/${id}`, { method: "DELETE" });
}

export async function uploadAsset(payload: {
  entityType: "STYLE" | "STYLE_SAMPLE" | "ORDER";
  entityId: string;
  kind: "SAMPLE_IMAGE" | "REFERENCE_IMAGE" | "TECH_PACK" | "ATTACHMENT";
  fileName: string;
  mimeType: string;
  dataBase64: string;
}) {
  return api<{ item: FileAssetItem }>("/api/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAsset(id: string) {
  return api<{ item: FileAssetItem }>(`/api/assets/${id}`);
}

export async function deleteAsset(id: string) {
  return api<void>(`/api/assets/${id}`, { method: "DELETE" });
}

export async function fetchStyleTechPack(styleId: string) {
  return api<StyleTechPackPayload>(`/api/masters/styles/${styleId}/tech-pack`);
}

export async function updateStyleTechPack(styleId: string, payload: {
  measurements: StyleMeasurementSpecItem[];
  threadSpecs: StyleThreadSpecItem[];
  colorways: StyleColorwayItem[];
}) {
  return api<StyleTechPackPayload>(`/api/masters/styles/${styleId}/tech-pack`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createStyleSample(styleId: string, payload: {
  sampleType: StyleSampleItem["sampleType"];
  status: StyleSampleItem["status"];
  notes?: string;
  assetIds?: string[];
}) {
  return api<{ item: StyleSampleItem }>(`/api/masters/styles/${styleId}/samples`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStyleSample(styleId: string, sampleId: string, payload: {
  sampleType: StyleSampleItem["sampleType"];
  status: StyleSampleItem["status"];
  notes?: string;
  assetIds?: string[];
}) {
  return api<{ item: StyleSampleItem }>(`/api/masters/styles/${styleId}/samples/${sampleId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function attachStyleAsset(styleId: string, payload: {
  assetId: string;
  kind?: FileAssetItem["kind"];
}) {
  return api<{ item: FileAssetItem }>(`/api/masters/styles/${styleId}/assets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteStyleAsset(styleId: string, assetId: string) {
  return api<void>(`/api/masters/styles/${styleId}/assets/${assetId}`, { method: "DELETE" });
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
  return withWorkflowChangeRequest(
    () => api<{ item: VendorDetailPayload["challans"][number] }>(`/api/vendors/${vendorId}/challans/${challanId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
    { module: "vendors", entityType: "VendorChallan", entityId: challanId, operation: "update" },
    payload,
  );
}

export async function fetchInventory() {
  return readDesktopOrRemote(
    desktopResources.inventory,
    () => api<InventoryPayload>("/api/inventory"),
    (payload) => ({ [desktopResources.inventory]: payload }),
  );
}

export async function createInventoryAdjustment(payload: { sku: string; deltaQty: number; reason: string }) {
  const inventory = await readDesktopSnapshot<InventoryPayload>(desktopResources.inventory);
  const item = inventory?.items.find((entry) => entry.id === payload.sku) as (InventoryPayload["items"][number] & { syncVersion?: string }) | undefined;
  return mutateDesktopOrRemote(
    {
      entityType: "inventory",
      entityId: payload.sku,
      operationType: "inventory.adjustment.create",
      payload,
      baseVersion: item?.syncVersion ?? null,
    },
    () => api<{ item: InventoryPayload["items"][number] }>("/api/inventory/adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function fetchProcurementRequests() {
  return readDesktopOrRemote(
    desktopResources.procurementRequests,
    () => api<ProcurementRequestsPayload>("/api/inventory/procurement-requests"),
    (payload) => ({ [desktopResources.procurementRequests]: payload }),
  );
}

export async function fetchProcurementPurchaseOrders() {
  return api<ProcurementPurchaseOrdersPayload>("/api/inventory/purchase-orders");
}

export async function createProcurementRequest(payload: { materialId: string; requestedQty: number; note: string }) {
  const inventory = await readDesktopSnapshot<InventoryPayload>(desktopResources.inventory);
  const item = inventory?.items.find((entry) => entry.materialId === payload.materialId) as (InventoryPayload["items"][number] & { syncVersion?: string }) | undefined;
  return mutateDesktopOrRemote(
    {
      entityType: "procurement_request",
      entityId: payload.materialId,
      operationType: "inventory.procurement.create",
      payload,
      baseVersion: item?.syncVersion ?? null,
    },
    () => api<{ item: ProcurementRequestsPayload["items"][number] }>("/api/inventory/procurement-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateProcurementRequest(id: string, payload: { requestedQty?: number; note?: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED" }) {
  const requests = await readDesktopSnapshot<ProcurementRequestsPayload>(desktopResources.procurementRequests);
  const item = requests?.items.find((entry) => entry.id === id) as (ProcurementRequestsPayload["items"][number] & { syncVersion?: string }) | undefined;
  return mutateDesktopOrRemote(
    {
      entityType: "procurement_request",
      entityId: id,
      operationType: "inventory.procurement.update",
      payload,
      baseVersion: item?.syncVersion ?? null,
    },
    () => withWorkflowChangeRequest(
      () => api<{ item: ProcurementRequestsPayload["items"][number] }>(`/api/inventory/procurement-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
      { module: "inventory", entityType: "ProcurementRequest", entityId: id, operation: "update" },
      payload,
    ),
  );
}

export async function createSupplierPurchaseOrder(payload: {
  procurementRequestId: string;
  orderedQty: number;
  expectedDate?: string | null;
  note?: string | null;
}) {
  return api<{ item: ProcurementPurchaseOrdersPayload["items"][number] }>("/api/inventory/purchase-orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSupplierPurchaseOrder(id: string, payload: {
  orderedQty?: number;
  expectedDate?: string | null;
  note?: string | null;
  status?: "DRAFT" | "ISSUED" | "PARTIAL_RECEIVED" | "RECEIVED" | "CANCELLED";
}) {
  return withWorkflowChangeRequest(
    () => api<{ item: ProcurementPurchaseOrdersPayload["items"][number] }>(`/api/inventory/purchase-orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
    { module: "inventory", entityType: "SupplierPurchaseOrder", entityId: id, operation: "update" },
    payload,
  );
}

export async function createGoodsReceipt(payload: {
  purchaseOrderId: string;
  receivedQty: number;
  receivedAt: string;
  note?: string | null;
}) {
  return api<{ item: { id: string; receiptNumber: string } }>("/api/inventory/goods-receipts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchQa() {
  return readDesktopOrRemote(
    desktopResources.qa,
    () => api<QaPayload>("/api/qa"),
    (payload) => ({ [desktopResources.qa]: payload }),
  );
}

export async function fetchProductionEntries() {
  return api<ProductionEntriesPayload>("/api/production/entries");
}

export async function createProductionEntry(payload: {
  metricDate: string;
  lineId: string;
  orderId?: string | null;
  shiftId?: string | null;
  stage: string;
  plannedQty: number;
  actualQty: number;
  rejectedQty: number;
  downtimeMinutes: number;
  downtimeReasonId?: string | null;
  remarks?: string | null;
}) {
  return api<{ item: ProductionEntriesPayload["items"][number] }>("/api/production/entries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProductionEntry(id: string, payload: {
  metricDate: string;
  lineId: string;
  orderId?: string | null;
  shiftId?: string | null;
  stage: string;
  plannedQty: number;
  actualQty: number;
  rejectedQty: number;
  downtimeMinutes: number;
  downtimeReasonId?: string | null;
  remarks?: string | null;
}) {
  return withWorkflowChangeRequest(
    () => api<{ item: ProductionEntriesPayload["items"][number] }>(`/api/production/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
    { module: "production", entityType: "ProductionEntry", entityId: id, operation: "update" },
    payload,
  );
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
  return mutateDesktopOrRemote(
    {
      entityType: "qa_inspection",
      entityId: payload.orderId ?? payload.lineId ?? payload.vendorId ?? "inspection",
      operationType: "qa.create",
      payload,
      baseVersion: payload.orderId ?? payload.lineId ?? payload.vendorId ?? null,
    },
    () => api<{ item: { id: string } }>("/api/qa/inspections", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
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
  const qa = await readDesktopSnapshot<QaPayload>(desktopResources.qa);
  const inspection = qa?.inspections.find((entry) => entry.id === id) as (QaPayload["inspections"][number] & { syncVersion?: string }) | undefined;
  return mutateDesktopOrRemote(
    {
      entityType: "qa_inspection",
      entityId: id,
      operationType: "qa.update",
      payload,
      baseVersion: inspection?.syncVersion ?? null,
    },
    () => withWorkflowChangeRequest(
      () => api<{ item: { id: string } }>(`/api/qa/inspections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
      { module: "qa", entityType: "QaInspection", entityId: id, operation: "update" },
      payload,
    ),
  );
}

export async function createCapa(payload: {
  inspectionId?: string | null;
  vendorId?: string | null;
  orderId?: string | null;
  lineId?: string | null;
  title: string;
  rootCause: string;
  ownerName: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
}) {
  return api<{ item: { id: string } }>("/api/qa/capa", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCapa(id: string, payload: {
  inspectionId?: string | null;
  vendorId?: string | null;
  orderId?: string | null;
  lineId?: string | null;
  title: string;
  rootCause: string;
  ownerName: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
}) {
  return withWorkflowChangeRequest(
    () => api<{ item: { id: string } }>(`/api/qa/capa/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
    { module: "qa", entityType: "CorrectiveAction", entityId: id, operation: "update" },
    payload,
  );
}

export async function fetchDispatch() {
  return readDesktopOrRemote(
    desktopResources.dispatch,
    () => api<DispatchPayload>("/api/dispatch"),
    (payload) => ({ [desktopResources.dispatch]: payload }),
  );
}

export async function createShipment(payload: {
  orderId: string;
  dispatchDate: string;
  quantity: number;
  invoiceNumber?: string;
  status?: "READY" | "SCHEDULED" | "DISPATCHED" | "CANCELLED";
}) {
  return mutateDesktopOrRemote(
    {
      entityType: "dispatch_shipment",
      entityId: payload.orderId,
      operationType: "dispatch.create",
      payload,
      baseVersion: payload.orderId,
    },
    () => api<{ item: DispatchPayload["items"][number] }>("/api/dispatch/shipments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateShipment(id: string, payload: {
  dispatchDate: string;
  quantity: number;
  invoiceNumber?: string;
  status?: "READY" | "SCHEDULED" | "DISPATCHED" | "CANCELLED";
}) {
  const dispatch = await readDesktopSnapshot<DispatchPayload>(desktopResources.dispatch);
  const shipment = dispatch?.items.flatMap((item) => item.shipments ?? []).find((entry) => entry.id === id) as ({ syncVersion?: string } & DispatchPayload["items"][number]["shipments"][number]) | undefined;
  return mutateDesktopOrRemote(
    {
      entityType: "dispatch_shipment",
      entityId: id,
      operationType: "dispatch.update",
      payload,
      baseVersion: shipment?.syncVersion ?? null,
    },
    () => withWorkflowChangeRequest(
      () => api<{ item: DispatchPayload["items"][number] }>(`/api/dispatch/shipments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
      { module: "dispatch", entityType: "DispatchShipment", entityId: id, operation: "update" },
      payload,
    ),
  );
}

export async function fetchSettings() {
  return api<SettingsPayload>("/api/settings");
}

export async function updateDesktopDevice(id: string, payload: { status: "ACTIVE" | "RESTRICTED" | "LOCKED" | "REVOKED"; rebuildRequired?: boolean }) {
  return api<{ item: NonNullable<SettingsPayload["desktopDevices"]>[number] }>(`/api/settings/desktop-devices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
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

export async function createSettingsUser(payload: {
  name: string;
  email: string;
  password: string;
  role: string;
  status: "ACTIVE" | "INACTIVE";
  departmentCode?: string | null;
  shiftCode?: string | null;
}) {
  return api<{ item: SettingsPayload["users"][number] }>("/api/settings/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type DashboardFilters = {
  dateFrom?: string;
  dateTo?: string;
  brandId?: string;
  status?: string;
  module?: string;
};

function buildQuery(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchDashboard(filters: DashboardFilters = {}) {
  return api<DashboardPayload>(`/api/dashboard${buildQuery(filters)}`);
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

export async function fetchGlobalSearch(q: string) {
  return api<SearchPayload>(`/api/search?q=${encodeURIComponent(q)}`);
}

export async function fetchNotifications() {
  return api<NotificationsPayload>("/api/notifications");
}
