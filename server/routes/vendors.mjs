import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, requireRoles, asyncHandler } from "../http.mjs";

const router = Router();

const challanSchema = z.object({
  orderId: z.string().min(1),
  challanDate: z.string().min(1),
  outwardQty: z.coerce.number().int().positive(),
});

const challanUpdateSchema = z.object({
  inwardQty: z.coerce.number().int().min(0),
  rejectedQty: z.coerce.number().int().min(0),
});

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function mapStatus(status) {
  if (status === "QA") return "QA";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function vendorSummary(vendor) {
  const pending = vendor.challans.reduce(
    (sum, challan) => sum + Math.max(0, challan.outwardQty - challan.inwardQty),
    0,
  );

  return {
    id: vendor.id,
    code: vendor.code,
    name: vendor.name,
    process: vendor.process,
    capacity: vendor.capacityPerDay,
    pending,
    otd: average(vendor.weeklyMetrics.map((item) => item.onTimePct)),
    quality: average(vendor.weeklyMetrics.map((item) => item.qualityPct)),
    status: vendor.status === "ACTIVE" ? "Active" : "Inactive",
  };
}

function weekLabel(index) {
  return `W${index}`;
}

router.get("/", asyncHandler(async (_req, res) => {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      challans: true,
      weeklyMetrics: true,
    },
  });

  return ok(res, {
    items: vendors.map(vendorSummary),
  });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: req.params.id },
    include: {
      challans: {
        include: {
          order: true,
        },
        orderBy: { challanDate: "desc" },
      },
      weeklyMetrics: {
        orderBy: { weekStartDate: "asc" },
      },
      qaInspections: true,
    },
  });

  if (!vendor) {
    return fail(res, 404, "Vendor not found", "VENDOR_NOT_FOUND");
  }

  const summary = vendorSummary(vendor);
  const utilisation = Math.min(100, summary.capacity > 0 ? Math.round((summary.pending / summary.capacity) * 100) : 0);
  const recentTrend = vendor.weeklyMetrics.slice(-6).map((metric, index, list) => ({
    wk: weekLabel(index + 1),
    otd: metric.onTimePct,
    qty: metric.throughputQty,
    quality: metric.qualityPct,
  }));
  const closedChallans = vendor.challans.filter((challan) => challan.status === "CLOSED").length;
  const challanClosure = vendor.challans.length ? Math.round((closedChallans / vendor.challans.length) * 100) : 0;
  const avgThroughput = average(vendor.weeklyMetrics.map((metric) => Math.min(100, Math.round((metric.throughputQty / Math.max(1, vendor.capacityPerDay * 7)) * 100))));
  const qaPassRate = vendor.qaInspections.length
    ? Math.round(
        vendor.qaInspections.reduce((sum, inspection) => sum + Math.round((inspection.approvedQty / Math.max(1, inspection.checkedQty)) * 100), 0) /
          vendor.qaInspections.length,
      )
    : summary.quality;

  const openOrders = await prisma.purchaseOrder.findMany({
    where: {
      status: {
        in: ["CREATED", "PLANNED", "IN_PRODUCTION", "QA", "DELAYED", "READY_TO_DISPATCH"],
      },
    },
    orderBy: { poNumber: "asc" },
    select: {
      id: true,
      poNumber: true,
    },
  });

  return ok(res, {
    item: summary,
    utilisation,
    trend: recentTrend,
    scorecard: [
      { k: "On-Time Delivery", v: summary.otd },
      { k: "Quality Pass Rate", v: qaPassRate },
      { k: "Capacity Utilisation", v: utilisation },
      { k: "Challan Closure", v: challanClosure },
      { k: "Weekly Throughput", v: avgThroughput },
    ],
    challans: vendor.challans.map((challan) => ({
      id: challan.id,
      challanNumber: challan.challanNumber,
      date: challan.challanDate.toISOString().slice(0, 10),
      po: challan.order.poNumber,
      orderId: challan.orderId,
      outQty: challan.outwardQty,
      inQty: challan.inwardQty,
      rejected: challan.rejectedQty,
      status: mapStatus(challan.status),
    })),
    orderOptions: openOrders,
  });
}));

router.post("/:id/challans", requireRoles("ADMIN", "VENDOR_MANAGER", "FACTORY_MANAGER"), asyncHandler(async (req, res) => {
  const parsed = challanSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid challan payload", "INVALID_CHALLAN_PAYLOAD", parsed.error.flatten());
  }

  const challanDate = new Date(parsed.data.challanDate);
  if (Number.isNaN(challanDate.getTime())) {
    return fail(res, 400, "Invalid challan date", "INVALID_CHALLAN_DATE");
  }

  const [vendor, order, latest] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: req.params.id } }),
    prisma.purchaseOrder.findUnique({ where: { id: parsed.data.orderId } }),
    prisma.vendorChallan.findFirst({
      orderBy: { createdAt: "desc" },
      select: { challanNumber: true },
    }),
  ]);

  if (!vendor) {
    return fail(res, 404, "Vendor not found", "VENDOR_NOT_FOUND");
  }
  if (!order) {
    return fail(res, 400, "Selected order no longer exists", "ORDER_NOT_FOUND");
  }
  if (order.status === "DISPATCHED") {
    return fail(res, 409, "Cannot issue challan for a dispatched order", "DISPATCHED_ORDER_CHALLAN");
  }

  const nextNumber = (() => {
    const last = latest?.challanNumber?.match(/CH-(\d+)/)?.[1];
    const serial = last ? Number(last) + 1 : 2404;
    return `CH-${serial}`;
  })();

  const challan = await prisma.vendorChallan.create({
    data: {
      challanNumber: nextNumber,
      vendorId: vendor.id,
      orderId: order.id,
      process: vendor.process,
      challanDate,
      outwardQty: parsed.data.outwardQty,
      inwardQty: 0,
      rejectedQty: 0,
      status: "OPEN",
    },
    include: {
      order: true,
    },
  });

  await writeAuditLog(req, {
    module: "Vendor",
    action: "Issued challan",
    targetType: "VendorChallan",
    targetId: challan.id,
    targetLabel: challan.challanNumber,
  });

  return ok(res, {
    item: {
      id: challan.id,
      challanNumber: challan.challanNumber,
      date: challan.challanDate.toISOString().slice(0, 10),
      po: challan.order.poNumber,
      orderId: challan.orderId,
      outQty: challan.outwardQty,
      inQty: challan.inwardQty,
      rejected: challan.rejectedQty,
      status: mapStatus(challan.status),
    },
  }, 201);
}));

router.patch("/:id/challans/:challanId", requireRoles("ADMIN", "VENDOR_MANAGER", "FACTORY_MANAGER"), asyncHandler(async (req, res) => {
  const parsed = challanUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid challan update payload", "INVALID_CHALLAN_UPDATE", parsed.error.flatten());
  }

  const challan = await prisma.vendorChallan.findFirst({
    where: { id: req.params.challanId, vendorId: req.params.id },
    include: { order: true },
  });
  if (!challan) {
    return fail(res, 404, "Challan not found", "CHALLAN_NOT_FOUND");
  }
  if (parsed.data.inwardQty + parsed.data.rejectedQty > challan.outwardQty) {
    return fail(res, 409, "Inward and rejected quantity cannot exceed outward quantity", "INVALID_CHALLAN_TOTALS");
  }

  const nextStatus =
    parsed.data.inwardQty === 0 && parsed.data.rejectedQty === 0
      ? "OPEN"
      : parsed.data.inwardQty + parsed.data.rejectedQty >= challan.outwardQty
        ? "CLOSED"
        : "PARTIAL";

  const updated = await prisma.vendorChallan.update({
    where: { id: challan.id },
    data: {
      inwardQty: parsed.data.inwardQty,
      rejectedQty: parsed.data.rejectedQty,
      status: nextStatus,
    },
    include: { order: true },
  });

  await writeAuditLog(req, {
    module: "Vendor",
    action: "Updated challan inward/rejection",
    targetType: "VendorChallan",
    targetId: updated.id,
    targetLabel: updated.challanNumber,
  });

  return ok(res, {
    item: {
      id: updated.id,
      challanNumber: updated.challanNumber,
      date: updated.challanDate.toISOString().slice(0, 10),
      po: updated.order.poNumber,
      orderId: updated.orderId,
      outQty: updated.outwardQty,
      inQty: updated.inwardQty,
      rejected: updated.rejectedQty,
      status: mapStatus(updated.status),
    },
  });
}));

export default router;
