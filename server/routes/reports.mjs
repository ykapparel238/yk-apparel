import { Router } from "express";
import { asyncHandler, fail, ok } from "../http.mjs";
import { getReportRows, getReportSummaries, toCsv, toPdfBuffer } from "../reporting.mjs";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  return ok(res, await getReportSummaries());
}));

router.get("/:slug.csv", asyncHandler(async (req, res) => {
  const payload = await getReportRows(req.params.slug);
  if (!payload) {
    return fail(res, 404, "Report not found", "REPORT_NOT_FOUND");
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${payload.report.slug}.csv"`);
  return res.status(200).send(toCsv(payload.rows));
}));

router.get("/:slug.pdf", asyncHandler(async (req, res) => {
  const payload = await getReportRows(req.params.slug);
  if (!payload) {
    return fail(res, 404, "Report not found", "REPORT_NOT_FOUND");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${payload.report.slug}.pdf"`);
  return res.status(200).send(toPdfBuffer(payload.report.name, payload.rows));
}));

router.get("/:slug", asyncHandler(async (req, res) => {
  const payload = await getReportRows(req.params.slug);
  if (!payload) {
    return fail(res, 404, "Report not found", "REPORT_NOT_FOUND");
  }
  return ok(res, {
    slug: payload.report.slug,
    name: payload.report.name,
    category: payload.report.category,
    rows: payload.rows,
  });
}));

export default router;
