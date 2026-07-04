import { prisma } from "./db.mjs";
import { ACTIVE_ORDER_STATUSES } from "./constants.mjs";

const ROLE_LABELS = {
  ADMIN: "Admin",
  FACTORY_MANAGER: "Factory Manager",
  PRODUCTION_PLANNER: "Production Planner",
  LINE_SUPERVISOR: "Line Supervisor",
  QA_MANAGER: "QA Manager",
  STORE_MANAGER: "Store Manager",
  VENDOR_MANAGER: "Vendor Manager",
  DISPATCH_MANAGER: "Dispatch Manager",
};

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function daysBetween(from, to) {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000);
}

function ageDays(since, now) {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86400000));
}

function ownerLabel(role) {
  return ROLE_LABELS[role] ?? role;
}

function exceptionItem({
  id,
  severity,
  module,
  title,
  summary,
  ownerRole,
  entityType,
  entityId,
  href,
  actionLabel,
  dueDate = null,
  createdAt = null,
  ageFrom = null,
}) {
  const now = new Date();
  return {
    id,
    severity,
    module,
    title,
    summary,
    ownerRole,
    owner: ownerLabel(ownerRole),
    entityType,
    entityId,
    href,
    actionLabel,
    dueDate: dueDate ? dateKey(dueDate) : null,
    ageDays: ageFrom ? ageDays(ageFrom, now) : createdAt ? ageDays(createdAt, now) : 0,
  };
}

function matchesRole(item, role) {
  if (!role || role === "ADMIN") return true;
  return item.ownerRole === role || item.ownerRole === "FACTORY_MANAGER";
}

export async function buildExceptionPayload({ role = "ADMIN" } = {}) {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);

  const [orders, todayEntries, materials, openCapas, challans] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { status: { in: [...ACTIVE_ORDER_STATUSES, "QA", "READY_TO_DISPATCH", "DELAYED"] } },
      include: {
        brand: true,
        style: true,
        productionPlans: { include: { line: true } },
        productionEntries: true,
        qaInspections: true,
        shipments: true,
        correctiveActions: true,
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.productionEntry.findMany({
      where: { metricDate: { gte: today, lt: tomorrow } },
      include: { order: true, line: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.material.findMany({
      include: { supplier: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.correctiveAction.findMany({
      where: { status: { not: "CLOSED" } },
      include: { order: true, vendor: true, line: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.vendorChallan.findMany({
      where: { status: { in: ["OPEN", "PARTIAL"] } },
      include: { vendor: true, order: true },
      orderBy: { challanDate: "asc" },
    }),
  ]);

  const items = [];

  for (const order of orders) {
    const remaining = Math.max(0, order.quantity - order.deliveredQty);
    const activePlan = order.productionPlans.find((plan) => plan.status === "ACTIVE");
    const hasProduction = order.productionEntries.length > 0;
    const hasQa = order.qaInspections.length > 0;
    const activeShipments = order.shipments.filter((shipment) => shipment.status !== "CANCELLED");
    const openCapaCount = order.correctiveActions.filter((item) => item.status !== "CLOSED").length;
    const dueInDays = daysBetween(today, order.dueDate);

    if (order.dueDate < today && remaining > 0 && order.status !== "DISPATCHED") {
      items.push(exceptionItem({
        id: `order-overdue-${order.id}`,
        severity: "critical",
        module: "Orders",
        title: `${order.poNumber} is overdue`,
        summary: `${remaining.toLocaleString("en-IN")} units still open for ${order.brand.name}.`,
        ownerRole: "FACTORY_MANAGER",
        entityType: "PurchaseOrder",
        entityId: order.id,
        href: `/orders/${order.id}`,
        actionLabel: "Review lifecycle",
        dueDate: order.dueDate,
        ageFrom: order.dueDate,
      }));
    }

    if (!activePlan && order.status === "CREATED" && dueInDays <= 14) {
      items.push(exceptionItem({
        id: `order-unplanned-${order.id}`,
        severity: dueInDays <= 7 ? "critical" : "warning",
        module: "Planning",
        title: `${order.poNumber} is not planned`,
        summary: `Due in ${Math.max(0, dueInDays)} days with ${order.quantity.toLocaleString("en-IN")} units.`,
        ownerRole: "PRODUCTION_PLANNER",
        entityType: "PurchaseOrder",
        entityId: order.id,
        href: "/planning",
        actionLabel: "Create plan",
        dueDate: order.dueDate,
        ageFrom: order.createdAt,
      }));
    }

    if (activePlan && activePlan.startDate <= tomorrow && activePlan.endDate >= today && !todayEntries.some((entry) => entry.orderId === order.id)) {
      items.push(exceptionItem({
        id: `production-missing-${order.id}`,
        severity: "warning",
        module: "Production",
        title: `${order.poNumber} has no actuals today`,
        summary: `${activePlan.line.name} target ${(activePlan.dailyTarget ?? activePlan.plannedQty).toLocaleString("en-IN")} units.`,
        ownerRole: "LINE_SUPERVISOR",
        entityType: "PurchaseOrder",
        entityId: order.id,
        href: "/production",
        actionLabel: "Add actuals",
        dueDate: activePlan.endDate,
        ageFrom: activePlan.startDate,
      }));
    }

    if (hasProduction && !hasQa && ["IN_PRODUCTION", "QA", "READY_TO_DISPATCH"].includes(order.status)) {
      items.push(exceptionItem({
        id: `qa-missing-${order.id}`,
        severity: "warning",
        module: "QA",
        title: `${order.poNumber} needs QA inspection`,
        summary: "Production actuals exist but no linked QA inspection is recorded.",
        ownerRole: "QA_MANAGER",
        entityType: "PurchaseOrder",
        entityId: order.id,
        href: "/qa",
        actionLabel: "Add inspection",
        dueDate: order.dueDate,
        ageFrom: order.updatedAt,
      }));
    }

    if (openCapaCount > 0) {
      items.push(exceptionItem({
        id: `qa-capa-${order.id}`,
        severity: "critical",
        module: "QA",
        title: `${order.poNumber} has open CAPA`,
        summary: `${openCapaCount} corrective action${openCapaCount === 1 ? "" : "s"} still open.`,
        ownerRole: "QA_MANAGER",
        entityType: "PurchaseOrder",
        entityId: order.id,
        href: "/qa",
        actionLabel: "Close CAPA",
        dueDate: order.dueDate,
        ageFrom: order.updatedAt,
      }));
    }

    if ((order.status === "QA" || order.status === "READY_TO_DISPATCH") && activeShipments.length === 0 && dueInDays <= 7) {
      items.push(exceptionItem({
        id: `dispatch-unscheduled-${order.id}`,
        severity: dueInDays <= 2 ? "critical" : "warning",
        module: "Dispatch",
        title: `${order.poNumber} dispatch not scheduled`,
        summary: `${remaining.toLocaleString("en-IN")} units remain, due ${dateKey(order.dueDate)}.`,
        ownerRole: "DISPATCH_MANAGER",
        entityType: "PurchaseOrder",
        entityId: order.id,
        href: "/dispatch",
        actionLabel: "Schedule dispatch",
        dueDate: order.dueDate,
        ageFrom: order.updatedAt,
      }));
    }
  }

  for (const entry of todayEntries) {
    if (entry.plannedQty > 0 && entry.actualQty < Math.round(entry.plannedQty * 0.85)) {
      items.push(exceptionItem({
        id: `production-below-target-${entry.id}`,
        severity: "warning",
        module: "Production",
        title: `${entry.line.name} below target`,
        summary: `${entry.order?.poNumber ?? "Unlinked"} actual ${entry.actualQty.toLocaleString("en-IN")} vs plan ${entry.plannedQty.toLocaleString("en-IN")}.`,
        ownerRole: "LINE_SUPERVISOR",
        entityType: "ProductionEntry",
        entityId: entry.id,
        href: "/production",
        actionLabel: "Review actuals",
        ageFrom: entry.createdAt,
      }));
    }
    if (entry.actualQty > 0 && entry.rejectedQty / entry.actualQty >= 0.05) {
      items.push(exceptionItem({
        id: `production-rejection-${entry.id}`,
        severity: entry.rejectedQty / entry.actualQty >= 0.1 ? "critical" : "warning",
        module: "Production",
        title: `${entry.line.name} rejection spike`,
        summary: `${entry.rejectedQty.toLocaleString("en-IN")} rejected from ${entry.actualQty.toLocaleString("en-IN")} actual units.`,
        ownerRole: "FACTORY_MANAGER",
        entityType: "ProductionEntry",
        entityId: entry.id,
        href: "/production",
        actionLabel: "Investigate",
        ageFrom: entry.createdAt,
      }));
    }
  }

  for (const material of materials) {
    if (Number(material.stockQty) <= Number(material.reorderLevel)) {
      items.push(exceptionItem({
        id: `material-low-${material.id}`,
        severity: Number(material.stockQty) <= 0 ? "critical" : "warning",
        module: "Inventory",
        title: `${material.sku} below reorder level`,
        summary: `${material.name} stock ${Number(material.stockQty).toLocaleString("en-IN")} / min ${Number(material.reorderLevel).toLocaleString("en-IN")}.`,
        ownerRole: "STORE_MANAGER",
        entityType: "Material",
        entityId: material.id,
        href: "/inventory",
        actionLabel: "Adjust or procure",
        ageFrom: material.updatedAt,
      }));
    }
  }

  for (const capa of openCapas) {
    if (capa.dueDate < today) {
      items.push(exceptionItem({
        id: `capa-overdue-${capa.id}`,
        severity: "critical",
        module: "QA",
        title: `CAPA overdue: ${capa.title}`,
        summary: `${capa.ownerName} owns action for ${capa.order?.poNumber ?? capa.vendor?.name ?? capa.line?.name ?? "operations"}.`,
        ownerRole: "QA_MANAGER",
        entityType: "CorrectiveAction",
        entityId: capa.id,
        href: "/qa",
        actionLabel: "Update CAPA",
        dueDate: capa.dueDate,
        ageFrom: capa.dueDate,
      }));
    }
  }

  for (const challan of challans) {
    const pending = Math.max(0, challan.outwardQty - challan.inwardQty);
    if (pending > 0 && ageDays(challan.challanDate, today) >= 3) {
      items.push(exceptionItem({
        id: `challan-pending-${challan.id}`,
        severity: ageDays(challan.challanDate, today) >= 7 ? "critical" : "warning",
        module: "Vendors",
        title: `${challan.challanNumber} pending inward`,
        summary: `${challan.vendor.name} / ${challan.order.poNumber} has ${pending.toLocaleString("en-IN")} units pending.`,
        ownerRole: "VENDOR_MANAGER",
        entityType: "VendorChallan",
        entityId: challan.id,
        href: `/vendors/${challan.vendorId}`,
        actionLabel: "Update challan",
        dueDate: challan.challanDate,
        ageFrom: challan.challanDate,
      }));
    }
  }

  const severityRank = { critical: 0, warning: 1, info: 2 };
  const filtered = items
    .filter((item) => matchesRole(item, role))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.ageDays - a.ageDays || a.title.localeCompare(b.title));

  const byOwner = new Map();
  const byModule = new Map();
  for (const item of filtered) {
    byOwner.set(item.owner, (byOwner.get(item.owner) ?? 0) + 1);
    byModule.set(item.module, (byModule.get(item.module) ?? 0) + 1);
  }

  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      total: filtered.length,
      critical: filtered.filter((item) => item.severity === "critical").length,
      warning: filtered.filter((item) => item.severity === "warning").length,
      info: filtered.filter((item) => item.severity === "info").length,
    },
    byOwner: Array.from(byOwner.entries()).map(([owner, count]) => ({ owner, count })),
    byModule: Array.from(byModule.entries()).map(([module, count]) => ({ module, count })),
    items: filtered.slice(0, 100),
  };
}
