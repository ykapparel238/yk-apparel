import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, requireRoles, asyncHandler } from "../http.mjs";

const router = Router();

const departmentSchema = z.object({
  head: z.string().min(2),
  staff: z.coerce.number().int().min(0),
  lines: z.coerce.number().int().min(0),
});

const shiftSchema = z.object({
  supervisor: z.string().min(2),
  headcount: z.coerce.number().int().min(0),
});

const userSchema = z.object({
  role: z.enum(["ADMIN", "FACTORY_MANAGER", "PRODUCTION_PLANNER", "MERCHANDISER", "QA_MANAGER", "STORE_MANAGER", "LINE_SUPERVISOR", "VENDOR_MANAGER", "DISPATCH_MANAGER"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  departmentCode: z.string().optional().nullable(),
  shiftCode: z.string().optional().nullable(),
});

const createUserSchema = userSchema.extend({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const desktopDeviceSchema = z.object({
  status: z.enum(["ACTIVE", "RESTRICTED", "LOCKED", "REVOKED"]),
  rebuildRequired: z.boolean().optional(),
});

function mapRole(value) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => {
      if (part === "qa") return "QA";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function formatLastActive(date) {
  if (!date) return "Never";
  return date.toISOString().slice(0, 16).replace("T", " ");
}

async function nextEmployeeCode() {
  const users = await prisma.user.findMany({
    select: { employeeCode: true },
  });
  const nextNumber = users.reduce((max, user) => {
    const match = /^U(\d+)$/i.exec(user.employeeCode);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0) + 1;
  return `U${String(nextNumber).padStart(3, "0")}`;
}

router.get("/", asyncHandler(async (_req, res) => {
  const [departments, shifts, users, auditLogs, devices] = await Promise.all([
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.shift.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({ orderBy: { employeeCode: "asc" } }),
    prisma.auditLog.findMany({
      orderBy: { occurredAt: "desc" },
      include: { actor: true },
      take: 20,
    }),
    prisma.desktopDevice.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        conflicts: true,
      },
    }),
  ]);

  return ok(res, {
    departments: departments.map((department) => ({
      id: department.code,
      name: department.name,
      head: department.headName,
      staff: department.staffCount,
      lines: department.lineCount,
    })),
    shifts: shifts.map((shift) => ({
      id: shift.code,
      name: shift.name,
      start: shift.startTime,
      end: shift.endTime,
      supervisor: shift.supervisorName,
      headcount: shift.headcount,
    })),
    users: users.map((user) => ({
      id: user.employeeCode,
      name: user.name,
      email: user.email,
      role: mapRole(user.role),
      status: user.status === "ACTIVE" ? "Active" : "Inactive",
      last: formatLastActive(user.lastActiveAt),
      departmentCode: departments.find((department) => department.id === user.departmentId)?.code ?? null,
      shiftCode: shifts.find((shift) => shift.id === user.shiftId)?.code ?? null,
    })),
    auditLog: auditLogs.map((item) => ({
      id: item.id,
      ts: item.occurredAt.toISOString().slice(0, 16).replace("T", " "),
      actor: item.actor?.name ?? "System",
      action: item.action,
      target: item.targetLabel,
      module: item.module,
    })),
    desktopDevices: devices.map((device) => ({
      id: device.id,
      clientVersion: device.clientVersion,
      workspaceId: device.workspaceId,
      status: device.status,
      rebuildRequired: device.rebuildRequired,
      lastSeenAt: device.lastSeenAt.toISOString().slice(0, 16).replace("T", " "),
      conflicts: device.conflicts.length,
    })),
  });
}));

router.patch("/desktop-devices/:id", requireRoles("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = desktopDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid desktop device payload", "INVALID_DESKTOP_DEVICE_PAYLOAD", parsed.error.flatten());
  }

  const existing = await prisma.desktopDevice.findUnique({ where: { id: req.params.id }, include: { conflicts: true } });
  if (!existing) {
    return fail(res, 404, "Desktop device not found", "DESKTOP_DEVICE_NOT_FOUND");
  }

  const updated = await prisma.desktopDevice.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      rebuildRequired: parsed.data.rebuildRequired ?? existing.rebuildRequired,
    },
    include: { conflicts: true },
  });

  await writeAuditLog(req, {
    module: "Settings",
    action: "Updated desktop device",
    targetType: "DesktopDevice",
    targetId: updated.id,
    targetLabel: updated.id,
  });

  return ok(res, {
    item: {
      id: updated.id,
      clientVersion: updated.clientVersion,
      workspaceId: updated.workspaceId,
      status: updated.status,
      rebuildRequired: updated.rebuildRequired,
      lastSeenAt: updated.lastSeenAt.toISOString().slice(0, 16).replace("T", " "),
      conflicts: updated.conflicts.length,
    },
  });
}));

router.patch("/departments/:code", requireRoles("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = departmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid department payload", "INVALID_DEPARTMENT_PAYLOAD", parsed.error.flatten());
  }

  const department = await prisma.department.findUnique({ where: { code: req.params.code } });
  if (!department) {
    return fail(res, 404, "Department not found", "DEPARTMENT_NOT_FOUND");
  }

  const updated = await prisma.department.update({
    where: { code: req.params.code },
    data: {
      headName: parsed.data.head,
      staffCount: parsed.data.staff,
      lineCount: parsed.data.lines,
    },
  });

  await writeAuditLog(req, {
    module: "Settings",
    action: "Updated department",
    targetType: "Department",
    targetId: updated.id,
    targetLabel: updated.name,
  });

  return ok(res, {
    item: {
      id: updated.code,
      name: updated.name,
      head: updated.headName,
      staff: updated.staffCount,
      lines: updated.lineCount,
    },
  });
}));

router.patch("/shifts/:code", requireRoles("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid shift payload", "INVALID_SHIFT_PAYLOAD", parsed.error.flatten());
  }

  const shift = await prisma.shift.findUnique({ where: { code: req.params.code } });
  if (!shift) {
    return fail(res, 404, "Shift not found", "SHIFT_NOT_FOUND");
  }

  const updated = await prisma.shift.update({
    where: { code: req.params.code },
    data: {
      supervisorName: parsed.data.supervisor,
      headcount: parsed.data.headcount,
    },
  });

  await writeAuditLog(req, {
    module: "Settings",
    action: "Updated shift",
    targetType: "Shift",
    targetId: updated.id,
    targetLabel: updated.name,
  });

  return ok(res, {
    item: {
      id: updated.code,
      name: updated.name,
      start: updated.startTime,
      end: updated.endTime,
      supervisor: updated.supervisorName,
      headcount: updated.headcount,
    },
  });
}));

router.post("/users", requireRoles("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid user payload", "INVALID_USER_PAYLOAD", parsed.error.flatten());
  }

  const [employeeCode, existingByEmail, department, shift] = await Promise.all([
    nextEmployeeCode(),
    prisma.user.findUnique({ where: { email: parsed.data.email } }),
    parsed.data.departmentCode ? prisma.department.findUnique({ where: { code: parsed.data.departmentCode } }) : Promise.resolve(null),
    parsed.data.shiftCode ? prisma.shift.findUnique({ where: { code: parsed.data.shiftCode } }) : Promise.resolve(null),
  ]);

  if (existingByEmail) {
    return fail(res, 409, "Email already exists", "USER_EMAIL_EXISTS");
  }
  if (parsed.data.departmentCode && !department) {
    return fail(res, 400, "Selected department not found", "DEPARTMENT_NOT_FOUND");
  }
  if (parsed.data.shiftCode && !shift) {
    return fail(res, 400, "Selected shift not found", "SHIFT_NOT_FOUND");
  }

  const created = await prisma.user.create({
    data: {
      employeeCode,
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: parsed.data.role,
      status: parsed.data.status,
      departmentId: department?.id ?? null,
      shiftId: shift?.id ?? null,
    },
  });

  await writeAuditLog(req, {
    module: "Settings",
    action: "Created user",
    targetType: "User",
    targetId: created.id,
    targetLabel: created.name,
  });

  return ok(res, {
    item: {
      id: created.employeeCode,
      name: created.name,
      email: created.email,
      role: mapRole(created.role),
      status: created.status === "ACTIVE" ? "Active" : "Inactive",
      last: formatLastActive(created.lastActiveAt),
      departmentCode: department?.code ?? null,
      shiftCode: shift?.code ?? null,
    },
  }, 201);
}));

router.patch("/users/:employeeCode", requireRoles("ADMIN"), asyncHandler(async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid user payload", "INVALID_USER_PAYLOAD", parsed.error.flatten());
  }

  const user = await prisma.user.findUnique({ where: { employeeCode: req.params.employeeCode } });
  if (!user) {
    return fail(res, 404, "User not found", "USER_NOT_FOUND");
  }

  const [department, shift] = await Promise.all([
    parsed.data.departmentCode ? prisma.department.findUnique({ where: { code: parsed.data.departmentCode } }) : Promise.resolve(null),
    parsed.data.shiftCode ? prisma.shift.findUnique({ where: { code: parsed.data.shiftCode } }) : Promise.resolve(null),
  ]);
  if (parsed.data.departmentCode && !department) {
    return fail(res, 400, "Selected department not found", "DEPARTMENT_NOT_FOUND");
  }
  if (parsed.data.shiftCode && !shift) {
    return fail(res, 400, "Selected shift not found", "SHIFT_NOT_FOUND");
  }

  const updated = await prisma.user.update({
    where: { employeeCode: req.params.employeeCode },
    data: {
      role: parsed.data.role,
      status: parsed.data.status,
      departmentId: department?.id ?? null,
      shiftId: shift?.id ?? null,
    },
  });

  await writeAuditLog(req, {
    module: "Settings",
    action: "Updated user role/status",
    targetType: "User",
    targetId: updated.id,
    targetLabel: updated.name,
  });

  return ok(res, {
    item: {
      id: updated.employeeCode,
      name: updated.name,
      email: updated.email,
      role: mapRole(updated.role),
      status: updated.status === "ACTIVE" ? "Active" : "Inactive",
      last: formatLastActive(updated.lastActiveAt),
    },
  });
}));

export default router;
