import { Router } from "express";
import { prisma } from "../db.mjs";
import { asyncHandler, ok } from "../http.mjs";
import { ACTIVE_ORDER_STATUSES } from "../constants.mjs";

const router = Router();

function formatTime(date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

router.get("/", asyncHandler(async (req, res) => {
  const isAdmin = req.sessionUser?.actualRole === "ADMIN" || req.sessionUser?.role === "ADMIN";
  const now = new Date();
  const [alerts, pendingRequests, delayedOrders, lowStock, qaIssues, dispatchReady] = await Promise.all([
    prisma.alert.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    isAdmin
      ? prisma.workflowChangeRequest.findMany({
          where: { status: "PENDING" },
          include: { requester: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { status: "DELAYED" },
          { dueDate: { lt: now }, status: { in: ACTIVE_ORDER_STATUSES } },
        ],
      },
      include: { brand: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.material.findMany({
      include: { supplier: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.qaInspection.findMany({
      where: { rejectedQty: { gt: 0 } },
      include: { order: true, vendor: true },
      orderBy: { inspectedAt: "desc" },
      take: 8,
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["QA", "READY_TO_DISPATCH"] } },
      include: { brand: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const items = [
    ...pendingRequests.map((item) => ({
      id: `change-${item.id}`,
      severity: "warning",
      title: `Change request pending from ${item.requester?.name ?? "user"}`,
      module: "Settings",
      time: formatTime(item.createdAt),
      href: "/settings",
    })),
    ...alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      severity: alert.severity.toLowerCase(),
      title: alert.title,
      module: alert.module,
      time: formatTime(alert.createdAt),
      href: "/",
    })),
    ...delayedOrders.map((order) => ({
      id: `order-${order.id}`,
      severity: "critical",
      title: `${order.poNumber} is delayed or overdue`,
      module: "Orders",
      time: formatTime(order.dueDate),
      href: `/orders/${order.id}`,
    })),
    ...lowStock.filter((material) => Number(material.stockQty) < Number(material.reorderLevel)).slice(0, 8).map((material) => ({
      id: `stock-${material.id}`,
      severity: "warning",
      title: `${material.sku} below reorder level`,
      module: "Inventory",
      time: formatTime(material.updatedAt),
      href: "/inventory",
    })),
    ...qaIssues.map((inspection) => ({
      id: `qa-${inspection.id}`,
      severity: "warning",
      title: `${inspection.rejectedQty} rejected in QA${inspection.order ? ` for ${inspection.order.poNumber}` : ""}`,
      module: "QA",
      time: formatTime(inspection.inspectedAt),
      href: "/qa",
    })),
    ...dispatchReady.map((order) => ({
      id: `dispatch-${order.id}`,
      severity: "info",
      title: `${order.poNumber} ready for dispatch`,
      module: "Dispatch",
      time: formatTime(order.updatedAt),
      href: "/dispatch",
    })),
  ].slice(0, 20);

  return ok(res, { count: items.length, items });
}));

export default router;
