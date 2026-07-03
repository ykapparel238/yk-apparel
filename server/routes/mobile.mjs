import { Router } from "express";
import { prisma } from "../db.mjs";
import { asyncHandler, ok } from "../http.mjs";
import { ACTIVE_ORDER_STATUSES } from "../constants.mjs";

const router = Router();

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, label: start.toISOString().slice(0, 10) };
}

function label(value) {
  if (!value) return "";
  if (value === "QA") return "QA";
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function action(id, labelText, type, tone = "primary", defaults = {}) {
  return { id, label: labelText, type, tone, defaults };
}

function card(id, title, subtitle, count, tone, actions = []) {
  return { id, title, subtitle, count, tone, actions };
}

function workItem(id, title, subtitle, tone, actionConfig) {
  return { id, title, subtitle, tone, action: actionConfig };
}

router.get("/today", asyncHandler(async (req, res) => {
  const role = req.sessionUser?.role ?? "GUEST";
  const { start, end, label: today } = todayRange();

  const shared = await Promise.all([
    prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      orderBy: { dueDate: "asc" },
      select: { id: true, poNumber: true },
      take: 50,
    }),
  ]);
  const [alerts, activeOrders] = shared;

  const payload = {
    date: today,
    role,
    greeting: "Today's mobile work queue",
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
    alerts: alerts.map((item) => ({
      id: item.id,
      title: item.title,
      severity: item.severity.toLowerCase(),
      module: item.module,
      time: item.createdAt.toISOString().slice(0, 16).replace("T", " "),
    })),
  };

  if (["LINE_SUPERVISOR", "FACTORY_MANAGER", "ADMIN"].includes(role)) {
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
        where: {
          status: "ACTIVE",
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: { order: true, line: true },
        orderBy: [{ endDate: "asc" }, { startDate: "asc" }],
        take: 8,
      }),
    ]);
    payload.cards.push(card("production", "Production actuals", `${entries.length} entries recorded today`, entries.length, "info", [action("production.create", "Add actuals", "productionEntry")]));
    payload.actions.push(action("production.create", "Add production actuals", "productionEntry"));
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
    payload.workItems.push(...plans.map((plan) => workItem(
      `production-${plan.id}`,
      `Record actuals for ${plan.order.poNumber}`,
      `${plan.line.name} · target ${(plan.dailyTarget ?? plan.plannedQty).toLocaleString("en-IN")} · due ${plan.order.dueDate.toISOString().slice(0, 10)}`,
      "info",
      action("production.plan", "Add actuals", "productionEntry", "primary", {
        orderId: plan.orderId,
        lineId: plan.lineId,
        metricDate: today,
        plannedQty: String(plan.dailyTarget ?? plan.plannedQty),
        stage: "KNITTING",
      }),
    )));
  }

  if (["QA_MANAGER", "ADMIN"].includes(role)) {
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
    payload.cards.push(card("qa", "QA inspections", `${rejected} rejected units today`, inspections.length, rejected ? "warning" : "success", [action("qa.create", "Add inspection", "qaInspection")]));
    payload.actions.push(action("qa.create", "Add QA inspection", "qaInspection"));
    payload.actions.push(action("qa.capa", "Raise CAPA", "qaCapa", "secondary"));
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
    payload.workItems.push(...qaOrders.map((order) => workItem(
      `qa-${order.id}`,
      `Inspect ${order.poNumber}`,
      `Due ${order.dueDate.toISOString().slice(0, 10)} · quality gate`,
      "warning",
      action("qa.order", "Add inspection", "qaInspection", "primary", {
        orderId: order.id,
        inspectedAt: today,
        stage: "QUALITY_CHECK",
      }),
    )));
  }

  if (["STORE_MANAGER", "ADMIN"].includes(role)) {
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
    payload.cards.push(card("stores", "Stores & procurement", `${lowStock.length} low-stock materials`, lowStock.length, lowStock.length ? "warning" : "success", [action("inventory.adjust", "Adjust stock", "inventoryAdjustment"), action("inventory.receipt", "Post receipt", "goodsReceipt", "secondary")]));
    payload.actions.push(action("inventory.adjust", "Adjust stock", "inventoryAdjustment"));
    payload.actions.push(action("inventory.procurement", "Update procurement request", "procurementRequestUpdate", "secondary"));
    payload.actions.push(action("inventory.supplierPo", "Update supplier PO", "supplierPoUpdate", "secondary"));
    payload.actions.push(action("inventory.receipt", "Post goods receipt", "goodsReceipt", "secondary"));
    payload.options.materials = materials.map((item) => ({ id: item.id, sku: item.sku, name: item.name, uom: item.uom, supplier: item.supplier?.name ?? "Unassigned" }));
    payload.options.procurementRequests = procurementRequests.map((item) => ({ id: item.id, material: item.material.name, sku: item.material.sku, requestedQty: Number(item.requestedQty), status: item.status }));
    payload.options.supplierPurchaseOrders = purchaseOrders.map((item) => ({ id: item.id, poNumber: item.poNumber, supplier: item.supplier.name, material: item.lines[0]?.material.name ?? "", balanceQty: Math.max(0, Number(item.lines[0]?.orderedQty ?? 0) - Number(item.lines[0]?.receivedQty ?? 0)) }));
    payload.workItems.push(...lowStock.slice(0, 5).map((item) => workItem(
      `store-${item.id}`,
      `Check stock ${item.sku}`,
      `${item.name} · stock ${Number(item.stockQty).toLocaleString("en-IN")} / min ${Number(item.reorderLevel).toLocaleString("en-IN")}`,
      "warning",
      action("inventory.adjust.low", "Adjust stock", "inventoryAdjustment", "primary", {
        sku: item.sku,
        reason: "Mobile low-stock count",
      }),
    )));
    payload.workItems.push(...procurementRequests.slice(0, 5).map((item) => workItem(
      `procurement-${item.id}`,
      `Follow up ${item.material.sku}`,
      `${item.material.name} · requested ${Number(item.requestedQty).toLocaleString("en-IN")}`,
      "info",
      action("inventory.procurement.followup", "Update request", "procurementRequestUpdate", "primary", {
        requestId: item.id,
        requestedQty: String(Number(item.requestedQty)),
        status: item.status === "OPEN" ? "IN_PROGRESS" : item.status,
      }),
    )));
  }

  if (["VENDOR_MANAGER", "FACTORY_MANAGER", "ADMIN"].includes(role)) {
    const [vendors, challans] = await Promise.all([
      prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.vendorChallan.findMany({
        where: { status: { in: ["OPEN", "PARTIAL"] } },
        include: { vendor: true, order: true },
        orderBy: { challanDate: "desc" },
        take: 20,
      }),
    ]);
    payload.cards.push(card("vendors", "Vendor challans", `${challans.length} open/partial challans`, challans.length, challans.length ? "warning" : "success", [action("vendor.updateChallan", "Update challan", "vendorChallan"), action("vendor.issueChallan", "Issue challan", "vendorIssueChallan", "secondary")]));
    payload.actions.push(action("vendor.updateChallan", "Update vendor challan", "vendorChallan"));
    payload.actions.push(action("vendor.issueChallan", "Issue vendor challan", "vendorIssueChallan", "secondary"));
    payload.options.vendors = payload.options.vendors.length ? payload.options.vendors : vendors;
    payload.options.challans = challans.map((item) => ({ id: item.id, vendorId: item.vendorId, vendor: item.vendor.name, challanNumber: item.challanNumber, orderPo: item.order.poNumber, outQty: item.outwardQty, inQty: item.inwardQty, rejectedQty: item.rejectedQty }));
    payload.workItems.push(...challans.slice(0, 6).map((item) => workItem(
      `challan-${item.id}`,
      `Receive ${item.challanNumber}`,
      `${item.vendor.name} · ${item.order.poNumber} · ${(item.outwardQty - item.inwardQty).toLocaleString("en-IN")} pending`,
      "warning",
      action("vendor.challan.receive", "Update challan", "vendorChallan", "primary", {
        challanId: item.id,
        inwardQty: String(Math.max(0, item.outwardQty - item.inwardQty)),
        rejectedQty: "0",
      }),
    )));
  }

  if (["DISPATCH_MANAGER", "FACTORY_MANAGER", "ADMIN"].includes(role)) {
    const dispatchOrders = await prisma.purchaseOrder.findMany({
      where: { status: { in: ["QA", "READY_TO_DISPATCH"] } },
      include: { brand: true, style: true, shipments: { orderBy: { createdAt: "desc" } } },
      orderBy: { dueDate: "asc" },
      take: 30,
    });
    payload.cards.push(card("dispatch", "Dispatch queue", `${dispatchOrders.length} orders ready or in QA`, dispatchOrders.length, dispatchOrders.length ? "info" : "success", [action("dispatch.create", "Schedule shipment", "dispatchShipment"), action("dispatch.update", "Correct shipment", "dispatchShipmentUpdate", "secondary")]));
    payload.actions.push(action("dispatch.create", "Schedule dispatch", "dispatchShipment"));
    payload.actions.push(action("dispatch.update", "Correct shipment", "dispatchShipmentUpdate", "secondary"));
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
    payload.workItems.push(...dispatchOrders.slice(0, 6).map((order) => workItem(
      `dispatch-${order.id}`,
      `Dispatch ${order.poNumber}`,
      `${order.brand.name} · ${Math.max(0, order.quantity - order.deliveredQty).toLocaleString("en-IN")} remaining · due ${order.dueDate.toISOString().slice(0, 10)}`,
      "info",
      action("dispatch.order", "Schedule dispatch", "dispatchShipment", "primary", {
        orderId: order.id,
        dispatchDate: today,
        quantity: String(Math.max(0, order.quantity - order.deliveredQty)),
      }),
    )));
  }

  if (!payload.cards.length) {
    payload.cards.push(card("overview", "Mobile overview", "No write queue is assigned to this role today.", 0, "info", []));
  }

  return ok(res, payload);
}));

export default router;
