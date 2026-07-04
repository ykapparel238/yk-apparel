import { Router } from "express";
import { asyncHandler, ok } from "../http.mjs";
import { buildExceptionPayload } from "../exceptions.mjs";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  return ok(res, await buildExceptionPayload({ role: req.sessionUser?.role ?? "ADMIN" }));
}));

export default router;
