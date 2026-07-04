import { Router } from "express";
import { asyncHandler, ok } from "../http.mjs";
import { buildOpsTodayPayload } from "../ops-work-items.mjs";

const router = Router();

function formatTime(value) {
  if (!value) return "";
  return value.slice(0, 16).replace("T", " ");
}

router.get("/", asyncHandler(async (req, res) => {
  const payload = await buildOpsTodayPayload(req, { limit: 20 });
  const items = payload.workItems.map((item) => ({
    id: item.id,
    severity: item.severity,
    title: item.title,
    module: item.module,
    time: formatTime(item.dueAt) || payload.date,
    href: item.route,
  }));

  return ok(res, { count: items.length, items });
}));

export default router;
