import { Router } from "express";
import { asyncHandler, ok } from "../http.mjs";
import { buildOpsTodayPayload } from "../ops-work-items.mjs";

const router = Router();

router.get("/today", asyncHandler(async (req, res) => {
  return ok(res, await buildOpsTodayPayload(req));
}));

export default router;
