import { Router } from "express";
import { asyncHandler, ok } from "../http.mjs";
import { getDashboardPayload } from "../reporting.mjs";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => ok(res, await getDashboardPayload())));

export default router;
