import { ApiError } from "./http.mjs";
import { prisma } from "./db.mjs";

export const CHANGE_REQUEST_REQUIRED = "CHANGE_REQUEST_REQUIRED";

export function isAdmin(req) {
  return req.sessionUser?.role === "ADMIN";
}

export function workflowDetails({ module, entityType, entityId, operation }) {
  return { module, entityType, entityId, operation };
}

export async function enforceWorkflowEditLimit(req, meta) {
  if (isAdmin(req)) return;

  const existing = await prisma.workflowEditLock.findUnique({
    where: {
      module_entityType_entityId_operation: workflowDetails(meta),
    },
  });

  if (existing) {
    throw new ApiError(409, "This record was already updated once. Submit a change request to admin.", CHANGE_REQUEST_REQUIRED, {
      ...workflowDetails(meta),
      lockedAt: existing.createdAt,
    });
  }
}

export async function recordWorkflowEditLock(req, meta, tx = prisma) {
  if (isAdmin(req)) return;

  await tx.workflowEditLock.upsert({
    where: {
      module_entityType_entityId_operation: workflowDetails(meta),
    },
    update: {},
    create: {
      ...workflowDetails(meta),
      actorUserId: req.sessionUser?.id ?? null,
    },
  });
}

export function mapWorkflowChangeRequest(item) {
  return {
    id: item.id,
    module: item.module,
    entityType: item.entityType,
    entityId: item.entityId,
    operation: item.operation,
    proposedPayload: item.proposedPayload,
    reason: item.reason,
    status: item.status,
    requester: item.requester?.name ?? "Unknown",
    requesterEmail: item.requester?.email ?? null,
    reviewer: item.reviewer?.name ?? null,
    reviewNote: item.reviewNote ?? null,
    reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString().slice(0, 16).replace("T", " ") : null,
    createdAt: item.createdAt.toISOString().slice(0, 16).replace("T", " "),
  };
}
