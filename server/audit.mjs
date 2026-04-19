import { prisma } from "./db.mjs";

export async function writeAuditLog(req, entry) {
  const client = entry.tx ?? prisma;
  await client.auditLog.create({
    data: {
      actorUserId: req.sessionUser?.id ?? null,
      module: entry.module,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel,
    },
  });
}
