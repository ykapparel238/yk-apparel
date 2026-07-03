import { Router } from "express";
import { z } from "zod";
import { asyncHandler, fail, ok } from "../http.mjs";
import { dashboardRows, getDashboardPayload, toCsv, toPdfBuffer } from "../reporting.mjs";

const router = Router();

const dashboardFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  brandId: z.string().optional(),
  status: z.enum(["CREATED", "PLANNED", "IN_PRODUCTION", "QA", "READY_TO_DISPATCH", "DISPATCHED", "DELAYED"]).optional(),
  module: z.string().optional(),
});

function parseFilters(req, res) {
  const parsed = dashboardFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    fail(res, 400, "Invalid dashboard filters", "INVALID_DASHBOARD_FILTERS", parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

router.get("/", asyncHandler(async (req, res) => {
  const filters = parseFilters(req, res);
  if (!filters) return;
  return ok(res, await getDashboardPayload(filters));
}));

router.get(".csv", asyncHandler(async (req, res) => {
  const filters = parseFilters(req, res);
  if (!filters) return;
  const payload = await getDashboardPayload(filters);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"dashboard.csv\"");
  return res.status(200).send(toCsv(dashboardRows(payload)));
}));

router.get(".pdf", asyncHandler(async (req, res) => {
  const filters = parseFilters(req, res);
  if (!filters) return;
  const payload = await getDashboardPayload(filters);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"dashboard.pdf\"");
  return res.status(200).send(toPdfBuffer("Dashboard Export", dashboardRows(payload)));
}));

export default router;
