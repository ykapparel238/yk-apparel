import { prisma } from "./db.mjs";
import { ACTIVE_ORDER_STATUSES } from "./constants.mjs";
import { buildExceptionPayload } from "./exceptions.mjs";

const ROLE_MODULES = {
  ADMIN: ["orders", "planning", "production", "qa", "inventory", "vendors", "dispatch", "settings", "sync", "alerts"],
  FACTORY_MANAGER: ["orders", "planning", "production", "vendors", "dispatch", "alerts"],
  MERCHANDISER: ["orders", "alerts"],
  PRODUCTION_PLANNER: ["orders", "planning", "production", "alerts"],
  LINE_SUPERVISOR: ["production", "alerts"],
  STORE_MANAGER: ["inventory", "alerts"],
  QA_MANAGER: ["qa", "alerts"],
  VENDOR_MANAGER: ["vendors", "alerts"],
  DISPATCH_MANAGER: ["dispatch", "alerts"],
};

const MODULE_PRIORITY = {
  settings: 10,
  sync: 15,
  orders: 20,
  production: 30,
  qa: 40,
  inventory: 50,
  vendors: 60,
  dispatch: 70,
  alerts: 80,
};

const SEVERITY_PRIORITY = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

export function todayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, label: start.toISOString().slice(0, 10) };
}

export function label(value) {
  if (!value) return "";
  if (value === "QA") return "QA";
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function canSeeModule(role, module) {
  return (ROLE_MODULES[role] ?? ["alerts"]).includes(module);
}

function action(id, labelText, type, tone = "primary", defaults = {}, route = "/") {
  return { id, label: labelText, type, tone, defaults, route };
}

function card(id, title, subtitle, count, tone, actions = []) {
  return { id, title, subtitle, count, tone, actions };
}

function workItem({
  id,
  module,
  entityType,
  entityId,
  title,
  subtitle,
  severity = "info",
  priority = 50,
  dueAt = null,
  status = "open",
  assignedRole = null,
  route,
  action: actionConfig,
}) {
  return {
    id,
    module,
    entityType,
    entityId,
    title,
    subtitle,
    severity,
    tone: severity,
    priority,
    dueAt,
    status,
    assignedRole,
    route,
    action: actionConfig ?? action(`view.${id}`, "View details", "view", "secondary", {}, route),
  };
}

function sortWorkItems(items) {
  return items.sort((a, b) => {
    const severity = (SEVERITY_PRIORITY[a.severity] ?? 9) - (SEVERITY_PRIORITY[b.severity] ?? 9);
    if (severity !== 0) return severity;
    const due = (a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER) - (b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER);
    if (due !== 0) return due;
    const module = (MODULE_PRIORITY[a.module] ?? 999) - (MODULE_PRIORITY[b.module] ?? 999);
    if (module !== 0) return module;
    return a.priority - b.priority;
  });
}

function formatTime(date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function basePayload(role, today, activeOrders, alerts) {
  return {
    date: today,
    role,
    greeting: "Today's guided operations queue",
    cards: [],
    actions: [],
    options: {
      orders: activeOrders,
      lines: [],
      shifts: [],
      downtimeReasons: [],
      defectTypes: [],
      vendors: [],
      qaInspections: [],
      materials: [],
      procurementRequests: [],
      supplierPurchaseOrders: [],
      dispatchOrders: [],
      dispatchShipments: [],
      challans: [],
    },
    workItems: [],
    recent: [],
    exceptions: [],
    alerts: alerts.map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity.toLowerCase(),
      module: item.module,
      time: formatTime(item.createdAt),
    })),
    summary: {
      critical: 0,
      warning: 0,
      total: 0,
      actionable: 0,
    },
    syncHealth: {
      conflicts: 0,
      devicesNeedingRebuild: 0,
    },
  };
}

export async function buildOpsTodayPayload(req, { limit = 30 } = {}) {
  const role = req.sessionUser?.role ?? "GUEST";
  const isRealAdmin = req.sessionUser?.actualRole === "ADMIN" || role === "ADMIN";
  const { start, end, label: today } = todayRange();

  const [alerts, activeOrders] = await Promise.all([
    prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      orderBy: { dueDate: "asc" },
      select: { id: true, poNumber: true },
      take: 50,
    }),
  ]);

  const payload = basePayload(role, today, activeOrders, alerts);

  if (canSeeModule(role, "orders")) {
    const delayedOrders = await prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { status: "DELAYED" },
          { dueDate: { lt: start }, status: { in: ACTIVE_ORDER_STATUSES } },
        ],
      },
      include: { brand: true, style: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    });
    payload.workItems.push(...delayedOrders.map((order) => workItem({
      id: `order-delay-${order.id}`,
      module: "orders",
      entityType: "PurchaseOrder",
      entityId: order.id,
      title: `${order.poNumber} needs escalation`,
      subtitle: `${order.brand.name} / ${order.style.name} · due ${order.dueDate.toISOString().slice(0, 10)}`,
      severity: "critical",
      priority: 10,
      dueAt: order.dueDate.toISOString(),
      assignedRole: "FACTORY_MANAGER",
      route: `/orders/${order.id}`,
      action: action("orders.view", "View order", "view", "secondary", {}, `/orders/${order.id}`),
    })));
  }

  if (["ADMIN", "LINE_SUPERVISOR", "FACTORY_MANAGER", "PRODUCTION_PLANNER"].includes(role)) {
    const [entries, lines, shifts, downtimeReasons, plans] = await Promise.all([
      prisma.productionEntry.findMany({
        where: { metricDate: { gte: start, lt: end } },
        include: { line: true, order: true, shift: true, downtimeReason: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.productionLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.shift.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.downtimeReason.findMany({ orderBy: { label: "asc" }, select: { id: true, code: true, label: true } }),
      prisma.productionPlan.findMany({
        where: { status: "ACTIVE", startDate: { lte: end }, endDate: { gte: start } },
        include: { order: true, line: true },
        orderBy: [{ endDate: "asc" }, { startDate: "asc" }],
        take: 8,
      }),
    ]);
    payload.cards.push(card("production", "Production actuals", `${entries.length} entries recorded today`, entries.length, "info", [action("production.create", "Add actuals", "productionEntry", "primary", {}, "/production")]));
    payload.actions.push(action("production.create", "Add production actuals", "productionEntry", "primary", {}, "/production"));
    payload.options.lines = lines;
    payload.options.shifts = shifts;
    payload.options.downtimeReasons = downtimeReasons;
    payload.recent.push(...entries.map((entry) => ({
      id: entry.id,
      type: "production",
      title: `${entry.line.name} / ${label(entry.stage)}`,
      subtitle: `${entry.order?.poNumber ?? "Unlinked"} · Actual ${entry.actualQty} · Reject ${entry.rejectedQty}`,
      route: "/production",
    })));
    payload.workItems.push(...plans.map((plan) => workItem({
      id: `production-${plan.id}`,
      module: "production",
      entityType: "ProductionPlan",
      entityId: plan.id,
      title: `Record actuals for ${plan.order.poNumber}`,
      subtitle: `${plan.line.name} · target ${(plan.dailyTarget ?? plan.plannedQty).toLocaleString("en-IN")} · due ${plan.order.dueDate.toISOString().slice(0, 10)}`,
      severity: "info",
      priority: 30,
      dueAt: plan.order.dueDate.toISOString(),
      assignedRole: "LINE_SUPERVISOR",
      route: "/production",
      action: action("production.plan", "Add actuals", "productionEntry", "primary", {
        orderId: plan.orderId,
        lineId: plan.lineId,
        metricDate: today,
        plannedQty: String(plan.dailyTarget ?? plan.plannedQty),
        stage: "KNITTING",
      }, "/production"),
    })));
  }

  if (["ADMIN", "QA_MANAGER"].includes(role)) {
    const [inspections, defectTypes, lines, vendors, qaOrders] = await Promise.all([
      prisma.qaInspection.findMany({
        where: { inspectedAt: { gte: start, lt: end } },
        include: { order: true, vendor: true, line: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.qaDefectType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.productionLine.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.purchaseOrder.findMany({
        where: { status: { in: ["QA", "READY_TO_DISPATCH"] } },
        orderBy: { dueDate: "asc" },
        select: { id: true, poNumber: true, dueDate: true },
        take: 8,
      }),
    ]);
    const rejected = inspections.reduce((sum, item) => sum + item.rejectedQty, 0);
    payload.cards.push(card("qa", "QA inspections", `${rejected} rejected units today`, inspections.length, rejected ? "warning" : "success", [action("qa.create", "Add inspection", "qaInspection", "primary", {}, "/qa")]));
    payload.actions.push(action("qa.create", "Add QA inspection", "qaInspection", "primary", {}, "/qa"));
    payload.actions.push(action("qa.capa", "Raise CAPA", "qaCapa", "secondary", {}, "/qa"));
    payload.options.defectTypes = defectTypes;
    payload.options.lines = payload.options.lines.length ? payload.options.lines : lines;
    payload.options.vendors = vendors;
    payload.options.qaInspections = inspections.map((inspection) => ({
      id: inspection.id,
      label: `${label(inspection.stage)} / ${inspection.order?.poNumber ?? inspection.vendor?.name ?? inspection.line?.name ?? "Unlinked"}`,
    }));
    payload.recent.push(...inspections.map((inspection) => ({
      id: inspection.id,
      type: "qa",
      title: `${label(inspection.stage)} inspection`,
      subtitle: `${inspection.order?.poNumber ?? inspection.vendor?.name ?? inspection.line?.name ?? "Unlinked"} · Checked ${inspection.checkedQty}`,
      route: "/qa",
    })));
    payload.workItems.push(...qaOrders.map((order) => workItem({
      id: `qa-${order.id}`,
      module: "qa",
      entityType: "PurchaseOrder",
      entityId: order.id,
      title: `Inspect ${order.poNumber}`,
      subtitle: `Due ${order.dueDate.toISOString().slice(0, 10)} · quality gate`,
      severity: "warning",
      priority: 35,
      dueAt: order.dueDate.toISOString(),
      assignedRole: "QA_MANAGER",
      route: "/qa",
      action: action("qa.order", "Add inspection", "qaInspection", "primary", { orderId: order.id, inspectedAt: today, stage: "QUALITY_CHECK" }, "/qa"),
    })));
  }

  if (["ADMIN", "STORE_MANAGER"].includes(role)) {
    const [materials, procurementRequests, purchaseOrders] = await Promise.all([
      prisma.material.findMany({ include: { supplier: true }, orderBy: { sku: "asc" }, take: 80 }),
      prisma.procurementRequest.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        include: { material: true, supplier: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.supplierPurchaseOrder.findMany({
        where: { status: { in: ["ISSUED", "PARTIAL_RECEIVED"] } },
        include: { supplier: true, lines: { include: { material: true } } },
        orderBy: { orderDate: "desc" },
        take: 20,
      }),
    ]);
    const lowStock = materials.filter((item) => Number(item.stockQty) <= Number(item.reorderLevel));
    payload.cards.push(card("stores", "Stores & procurement", `${lowStock.length} low-stock materials`, lowStock.length, lowStock.length ? "warning" : "success", [action("inventory.adjust", "Adjust stock", "inventoryAdjustment", "primary", {}, "/inventory"), action("inventory.receipt", "Post receipt", "goodsReceipt", "secondary", {}, "/inventory")]));
    payload.actions.push(action("inventory.adjust", "Adjust stock", "inventoryAdjustment", "primary", {}, "/inventory"));
    payload.actions.push(action("inventory.procurement", "Update procurement request", "procurementRequestUpdate", "secondary", {}, "/inventory"));
    payload.actions.push(action("inventory.supplierPo", "Update supplier PO", "supplierPoUpdate", "secondary", {}, "/inventory"));
    payload.actions.push(action("inventory.receipt", "Post goods receipt", "goodsReceipt", "secondary", {}, "/inventory"));
    payload.options.materials = materials.map((item) => ({ id: item.id, sku: item.sku, name: item.name, uom: item.uom, supplier: item.supplier?.name ?? "Unassigned" }));
    payload.options.procurementRequests = procurementRequests.map((item) => ({ id: item.id, material: item.material.name, sku: item.material.sku, requestedQty: Number(item.requestedQty), status: item.status }));
    payload.options.supplierPurchaseOrders = purchaseOrders.map((item) => ({ id: item.id, poNumber: item.poNumber, supplier: item.supplier.name, material: item.lines[0]?.material.name ?? "", balanceQty: Math.max(0, Number(item.lines[0]?.orderedQty ?? 0) - Number(item.lines[0]?.receivedQty ?? 0)) }));
    payload.workItems.push(...lowStock.slice(0, 5).map((item) => workItem({
      id: `store-${item.id}`,
      module: "inventory",
      entityType: "Material",
      entityId: item.id,
      title: `Check stock ${item.sku}`,
      subtitle: `${item.name} · stock ${Number(item.stockQty).toLocaleString("en-IN")} / min ${Number(item.reorderLevel).toLocaleString("en-IN")}`,
      severity: "warning",
      priority: 40,
      assignedRole: "STORE_MANAGER",
      route: "/inventory",
      action: action("inventory.adjust.low", "Adjust stock", "inventoryAdjustment", "primary", { sku: item.sku, reason: "Mobile low-stock count" }, "/inventory"),
    })));
    payload.workItems.push(...procurementRequests.slice(0, 5).map((item) => workItem({
      id: `procurement-${item.id}`,
      module: "inventory",
      entityType: "ProcurementRequest",
      entityId: item.id,
      title: `Follow up ${item.material.sku}`,
      subtitle: `${item.material.name} · requested ${Number(item.requestedQty).toLocaleString("en-IN")}`,
      severity: "info",
      priority: 45,
      assignedRole: "STORE_MANAGER",
      route: "/inventory",
      action: action("inventory.procurement.followup", "Update request", "procurementRequestUpdate", "primary", {
        requestId: item.id,
        requestedQty: String(Number(item.requestedQty)),
        status: item.status === "OPEN" ? "IN_PROGRESS" : item.status,
      }, "/inventory"),
    })));
  }

  if (["ADMIN", "VENDOR_MANAGER", "FACTORY_MANAGER"].includes(role)) {
    const [vendors, challans] = await Promise.all([
      prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.vendorChallan.findMany({
        where: { status: { in: ["OPEN", "PARTIAL"] } },
        include: { vendor: true, order: true },
        orderBy: { challanDate: "desc" },
        take: 20,
      }),
    ]);
    payload.cards.push(card("vendors", "Vendor challans", `${challans.length} open/partial challans`, challans.length, challans.length ? "warning" : "success", [action("vendor.updateChallan", "Update challan", "vendorChallan", "primary", {}, "/vendors"), action("vendor.issueChallan", "Issue challan", "vendorIssueChallan", "secondary", {}, "/vendors")]));
    payload.actions.push(action("vendor.updateChallan", "Update vendor challan", "vendorChallan", "primary", {}, "/vendors"));
    payload.actions.push(action("vendor.issueChallan", "Issue vendor challan", "vendorIssueChallan", "secondary", {}, "/vendors"));
    payload.options.vendors = payload.options.vendors.length ? payload.options.vendors : vendors;
    payload.options.challans = challans.map((item) => ({ id: item.id, vendorId: item.vendorId, vendor: item.vendor.name, challanNumber: item.challanNumber, orderPo: item.order.poNumber, outQty: item.outwardQty, inQty: item.inwardQty, rejectedQty: item.rejectedQty }));
    payload.workItems.push(...challans.slice(0, 6).map((item) => workItem({
      id: `challan-${item.id}`,
      module: "vendors",
      entityType: "VendorChallan",
      entityId: item.id,
      title: `Receive ${item.challanNumber}`,
      subtitle: `${item.vendor.name} · ${item.order.poNumber} · ${(item.outwardQty - item.inwardQty).toLocaleString("en-IN")} pending`,
      severity: "warning",
      priority: 55,
      dueAt: item.challanDate.toISOString(),
      assignedRole: "VENDOR_MANAGER",
      route: `/vendors/${item.vendorId}`,
      action: action("vendor.challan.receive", "Update challan", "vendorChallan", "primary", {
        challanId: item.id,
        inwardQty: String(Math.max(0, item.outwardQty - item.inwardQty)),
        rejectedQty: "0",
      }, `/vendors/${item.vendorId}`),
    })));
  }

  if (["ADMIN", "DISPATCH_MANAGER", "FACTORY_MANAGER"].includes(role)) {
    const dispatchOrders = await prisma.purchaseOrder.findMany({
      where: { status: { in: ["QA", "READY_TO_DISPATCH"] } },
      include: { brand: true, style: true, shipments: { orderBy: { createdAt: "desc" } } },
      orderBy: { dueDate: "asc" },
      take: 30,
    });
    payload.cards.push(card("dispatch", "Dispatch queue", `${dispatchOrders.length} orders ready or in QA`, dispatchOrders.length, dispatchOrders.length ? "info" : "success", [action("dispatch.create", "Schedule shipment", "dispatchShipment", "primary", {}, "/dispatch"), action("dispatch.update", "Correct shipment", "dispatchShipmentUpdate", "secondary", {}, "/dispatch")]));
    payload.actions.push(action("dispatch.create", "Schedule dispatch", "dispatchShipment", "primary", {}, "/dispatch"));
    payload.actions.push(action("dispatch.update", "Correct shipment", "dispatchShipmentUpdate", "secondary", {}, "/dispatch"));
    payload.options.dispatchOrders = dispatchOrders.map((order) => ({ id: order.id, poNumber: order.poNumber, brand: order.brand.name, styleName: order.style.name, remaining: Math.max(0, order.quantity - order.deliveredQty), due: order.dueDate.toISOString().slice(0, 10) }));
    payload.options.dispatchShipments = dispatchOrders.flatMap((order) => (order.shipments ?? []).map((shipment) => ({
      id: shipment.id,
      orderId: order.id,
      label: `${shipment.shipmentNumber} / ${order.poNumber}`,
      dispatchDate: shipment.dispatchDate.toISOString().slice(0, 10),
      quantity: shipment.quantity,
      invoiceNumber: shipment.invoiceNumber ?? "",
      status: shipment.status,
    })));
    payload.workItems.push(...dispatchOrders.slice(0, 6).map((order) => workItem({
      id: `dispatch-${order.id}`,
      module: "dispatch",
      entityType: "PurchaseOrder",
      entityId: order.id,
      title: `Dispatch ${order.poNumber}`,
      subtitle: `${order.brand.name} · ${Math.max(0, order.quantity - order.deliveredQty).toLocaleString("en-IN")} remaining · due ${order.dueDate.toISOString().slice(0, 10)}`,
      severity: "info",
      priority: 60,
      dueAt: order.dueDate.toISOString(),
      assignedRole: "DISPATCH_MANAGER",
      route: "/dispatch",
      action: action("dispatch.order", "Schedule dispatch", "dispatchShipment", "primary", {
        orderId: order.id,
        dispatchDate: today,
        quantity: String(Math.max(0, order.quantity - order.deliveredQty)),
      }, "/dispatch"),
    })));
  }

  if (isRealAdmin) {
    const [changeRequests, syncConflicts, rebuildDevices] = await Promise.all([
      prisma.workflowChangeRequest.findMany({
        where: { status: "PENDING" },
        include: { requester: true },
        orderBy: { createdAt: "asc" },
        take: 12,
      }),
      prisma.syncConflict.findMany({ orderBy: { createdAt: "asc" }, take: 10 }),
      prisma.desktopDevice.findMany({ where: { rebuildRequired: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
    ]);
    payload.syncHealth.conflicts = syncConflicts.length;
    payload.syncHealth.devicesNeedingRebuild = rebuildDevices.length;
    payload.workItems.push(...changeRequests.map((item) => workItem({
      id: `change-${item.id}`,
      module: "settings",
      entityType: "WorkflowChangeRequest",
      entityId: item.id,
      title: `Approve change from ${item.requester?.name ?? "user"}`,
      subtitle: `${label(item.module)} / ${item.entityType} · ${item.operation}`,
      severity: "warning",
      priority: 12,
      dueAt: item.createdAt.toISOString(),
      assignedRole: "ADMIN",
      route: "/settings",
      action: action("settings.changeRequest", "Review request", "view", "secondary", {}, "/settings"),
    })));
    payload.workItems.push(...syncConflicts.map((item) => workItem({
      id: `sync-conflict-${item.id}`,
      module: "sync",
      entityType: "SyncConflict",
      entityId: item.id,
      title: "Resolve desktop sync conflict",
      subtitle: item.summary,
      severity: "critical",
      priority: 8,
      dueAt: item.createdAt.toISOString(),
      assignedRole: "ADMIN",
      route: "/settings",
      action: action("sync.resolve", "Open sync panel", "view", "secondary", {}, "/settings"),
    })));
    payload.workItems.push(...rebuildDevices.map((item) => workItem({
      id: `sync-rebuild-${item.id}`,
      module: "sync",
      entityType: "DesktopDevice",
      entityId: item.id,
      title: "Desktop cache rebuild required",
      subtitle: `${item.id} · last seen ${item.lastSeenAt.toISOString().slice(0, 10)}`,
      severity: "warning",
      priority: 14,
      dueAt: item.updatedAt.toISOString(),
      assignedRole: "ADMIN",
      route: "/settings",
      action: action("sync.rebuild", "Open sync panel", "view", "secondary", {}, "/settings"),
    })));
  }

  payload.workItems.push(...alerts.filter((item) => !item.resolvedAt).map((item) => workItem({
    id: `alert-${item.id}`,
    module: "alerts",
    entityType: "Alert",
    entityId: item.id,
    title: item.title,
    subtitle: item.module,
    severity: item.severity.toLowerCase(),
    priority: 90,
    dueAt: item.createdAt.toISOString(),
    assignedRole: null,
    route: item.orderId ? `/orders/${item.orderId}` : item.materialId ? "/inventory" : item.vendorId ? `/vendors/${item.vendorId}` : "/",
    action: action("alert.view", "View details", "view", "secondary", {}, item.orderId ? `/orders/${item.orderId}` : item.materialId ? "/inventory" : item.vendorId ? `/vendors/${item.vendorId}` : "/"),
  })).filter((item) => canSeeModule(role, item.module)));

  payload.workItems = sortWorkItems(payload.workItems).slice(0, limit);
  payload.summary.total = payload.workItems.length;
  payload.summary.critical = payload.workItems.filter((item) => item.severity === "critical").length;
  payload.summary.warning = payload.workItems.filter((item) => item.severity === "warning").length;
  payload.summary.actionable = payload.workItems.filter((item) => item.action?.type && item.action.type !== "view").length;
  const exceptions = await buildExceptionPayload({ role });
  payload.exceptions = exceptions.items.slice(0, 5).map((item) => ({
    id: item.id,
    severity: item.severity,
    title: item.title,
    module: item.module,
    owner: item.owner,
    href: item.href,
    actionLabel: item.actionLabel,
  }));

  if (!payload.cards.length) {
    payload.cards.push(card("overview", "Operations overview", "No write queue is assigned to this role today.", 0, "info", []));
  }

  return payload;
}
