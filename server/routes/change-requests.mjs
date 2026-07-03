import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { asyncHandler, fail, ok } from "../http.mjs";
import { writeAuditLog } from "../audit.mjs";
import { mapWorkflowChangeRequest } from "../workflow-control.mjs";

const router = Router();

const changeRequestSchema = z.object({
  module: z.string().min(1).max(80),
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(160),
  operation: z.string().min(1).max(80),
  proposedPayload: z.unknown(),
  reason: z.string().trim().min(5).max(1000),
});

router.post("/", asyncHandler(async (req, res) => {
  const parsed = changeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid change request payload", "INVALID_CHANGE_REQUEST_PAYLOAD", parsed.error.flatten());
  }

  const existing = await prisma.workflowChangeRequest.findFirst({
    where: {
      module: parsed.data.module,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      operation: parsed.data.operation,
      status: "PENDING",
      requesterUserId: req.sessionUser?.id ?? null,
    },
  });

  if (existing) {
    return fail(res, 409, "A pending change request already exists for this record", "CHANGE_REQUEST_EXISTS", {
      id: existing.id,
    });
  }

  const created = await prisma.workflowChangeRequest.create({
    data: {
      module: parsed.data.module,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      operation: parsed.data.operation,
      proposedPayload: parsed.data.proposedPayload,
      reason: parsed.data.reason,
      requesterUserId: req.sessionUser?.id ?? null,
    },
    include: {
      requester: true,
      reviewer: true,
    },
  });

  await writeAuditLog(req, {
    module: "Workflow",
    action: "Submitted change request",
    targetType: "WorkflowChangeRequest",
    targetId: created.id,
    targetLabel: `${created.module} / ${created.entityType}`,
  });

  return ok(res, { item: mapWorkflowChangeRequest(created) }, 201);
}));

export default router;
