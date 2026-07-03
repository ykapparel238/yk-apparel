import { ApiError, api } from "@/lib/api";

export type ChangeRequestMeta = {
  module: string;
  entityType: string;
  entityId: string;
  operation: string;
};

export type WorkflowChangeRequestItem = ChangeRequestMeta & {
  id: string;
  proposedPayload: unknown;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requester: string;
  requesterEmail?: string | null;
  reviewer?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export async function submitWorkflowChangeRequest(payload: ChangeRequestMeta & {
  proposedPayload: unknown;
  reason: string;
}) {
  return api<{ item: WorkflowChangeRequestItem }>("/api/change-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function withWorkflowChangeRequest<T>(
  action: () => Promise<T>,
  meta: ChangeRequestMeta,
  proposedPayload: unknown,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "CHANGE_REQUEST_REQUIRED") {
      throw error;
    }

    const reason = typeof window !== "undefined"
      ? window.prompt("This record was already updated once. Enter the reason to request admin approval for this change:")
      : null;

    if (!reason?.trim()) {
      throw error;
    }

    await submitWorkflowChangeRequest({
      ...meta,
      proposedPayload,
      reason: reason.trim(),
    });

    throw new Error("Change request submitted to admin");
  }
}

export async function fetchWorkflowChangeRequests() {
  return api<{ items: WorkflowChangeRequestItem[] }>("/api/settings/change-requests");
}

export async function approveWorkflowChangeRequest(id: string, note = "") {
  return api<{ item: WorkflowChangeRequestItem }>(`/api/settings/change-requests/${id}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export async function rejectWorkflowChangeRequest(id: string, note = "") {
  return api<{ item: WorkflowChangeRequestItem }>(`/api/settings/change-requests/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}
