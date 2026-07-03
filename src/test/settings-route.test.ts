import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  department: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  shift: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
  },
  desktopDevice: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const writeAuditLog = vi.fn();

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog }));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload ?? null;
      return this;
    },
  };
}

async function invokeRoute(router, method, path, reqOverrides = {}) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  const req = {
    body: {},
    query: {},
    params: {},
    sessionUser: { id: "u1", role: "ADMIN" },
    ...reqOverrides,
  };
  const res = createRes();
  const stack = layer.route.stack.map((entry) => entry.handle);
  for (const handler of stack) {
    let nextCalled = false;
    let nextError = null;
    await Promise.resolve(handler(req, res, (error) => {
      nextCalled = true;
      nextError = error ?? null;
    }));
    if (nextError) throw nextError;
    if (!nextCalled && handler.length >= 3) break;
  }
  return { req, res };
}

describe("settings route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates departments and writes audit logs", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.department.findUnique.mockResolvedValue({
      id: "dep-1",
      code: "CUT",
      name: "Cutting",
      headName: "Old Head",
      staffCount: 10,
      lineCount: 2,
    });
    prisma.department.update.mockResolvedValue({
      id: "dep-1",
      code: "CUT",
      name: "Cutting",
      headName: "New Head",
      staffCount: 12,
      lineCount: 3,
    });

    const { res } = await invokeRoute(route, "patch", "/departments/:code", {
      params: { code: "CUT" },
      body: { head: "New Head", staff: 12, lines: 3 },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.department.update).toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "Updated department" }));
  });

  it("rejects invalid department payloads", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;

    const { res } = await invokeRoute(route, "patch", "/departments/:code", {
      params: { code: "CUT" },
      body: { head: "", staff: -1, lines: 3 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_DEPARTMENT_PAYLOAD");
  });

  it("returns not found for missing shifts", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.shift.findUnique.mockResolvedValue(null);

    const { res } = await invokeRoute(route, "patch", "/shifts/:code", {
      params: { code: "A" },
      body: { supervisor: "Meena", headcount: 25 },
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("SHIFT_NOT_FOUND");
  });

  it("rejects user updates with missing department references", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      employeeCode: "EMP-1",
      name: "Rohit",
      email: "rohit@knitcraft.in",
      role: "ADMIN",
      status: "ACTIVE",
      lastActiveAt: new Date("2026-04-19T10:00:00.000Z"),
    });
    prisma.department.findUnique.mockResolvedValue(null);
    prisma.shift.findUnique.mockResolvedValue(null);

    const { res } = await invokeRoute(route, "patch", "/users/:employeeCode", {
      params: { employeeCode: "EMP-1" },
      body: {
        role: "MERCHANDISER",
        status: "ACTIVE",
        departmentCode: "MISSING",
        shiftCode: null,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("DEPARTMENT_NOT_FOUND");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates users and writes audit logs", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      employeeCode: "EMP-1",
      name: "Rohit",
      email: "rohit@knitcraft.in",
      role: "ADMIN",
      status: "ACTIVE",
      lastActiveAt: new Date("2026-04-19T10:00:00.000Z"),
    });
    prisma.department.findUnique.mockResolvedValue({
      id: "dep-1",
      code: "MERCH",
      name: "Merchandising",
    });
    prisma.shift.findUnique.mockResolvedValue({
      id: "shift-1",
      code: "A",
      name: "Shift A",
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      employeeCode: "EMP-1",
      name: "Rohit",
      email: "rohit@knitcraft.in",
      role: "MERCHANDISER",
      status: "ACTIVE",
      lastActiveAt: new Date("2026-04-19T10:00:00.000Z"),
    });

    const { res } = await invokeRoute(route, "patch", "/users/:employeeCode", {
      params: { employeeCode: "EMP-1" },
      body: {
        role: "MERCHANDISER",
        status: "ACTIVE",
        departmentCode: "MERCH",
        shiftCode: "A",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { employeeCode: "EMP-1" },
      data: {
        role: "MERCHANDISER",
        status: "ACTIVE",
        departmentId: "dep-1",
        shiftId: "shift-1",
      },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "Updated user role/status" }));
  });

  it("creates users and writes audit logs", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.user.findMany.mockResolvedValue([{ employeeCode: "U001" }, { employeeCode: "ADMIN-001" }]);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue({
      id: "dep-1",
      code: "ADMIN",
      name: "Administration",
    });
    prisma.shift.findUnique.mockResolvedValue({
      id: "shift-1",
      code: "GENERAL",
      name: "General Shift",
    });
    prisma.user.create.mockResolvedValue({
      id: "user-2",
      employeeCode: "EMP-2",
      name: "New User",
      email: "new@ykapparel.com",
      role: "MERCHANDISER",
      status: "ACTIVE",
      lastActiveAt: null,
    });

    const { res } = await invokeRoute(route, "post", "/users", {
      body: {
        name: "New User",
        email: "NEW@YKAPPAREL.COM",
        password: "password123",
        role: "MERCHANDISER",
        status: "ACTIVE",
        departmentCode: "ADMIN",
        shiftCode: "GENERAL",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeCode: "U002",
        name: "New User",
        email: "new@ykapparel.com",
        role: "MERCHANDISER",
        status: "ACTIVE",
        departmentId: "dep-1",
        shiftId: "shift-1",
      }),
    });
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).not.toBe("password123");
    expect(writeAuditLog).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "Created user" }));
  });

  it("rejects duplicate user emails", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.user.findMany.mockResolvedValue([{ employeeCode: "U001" }]);
    prisma.user.findUnique.mockResolvedValue({ id: "existing", email: "new@ykapparel.com" });

    const { res } = await invokeRoute(route, "post", "/users", {
      body: {
        name: "New User",
        email: "new@ykapparel.com",
        password: "password123",
        role: "MERCHANDISER",
        status: "ACTIVE",
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("USER_EMAIL_EXISTS");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("blocks non-admin writes", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;

    const { res } = await invokeRoute(route, "patch", "/users/:employeeCode", {
      sessionUser: { id: "u2", role: "MERCHANDISER" },
      params: { employeeCode: "EMP-1" },
      body: {
        role: "MERCHANDISER",
        status: "ACTIVE",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("updates desktop devices and writes audit logs", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.desktopDevice.findUnique.mockResolvedValue({
      id: "device-1",
      clientVersion: "1.0.0",
      workspaceId: "default",
      status: "ACTIVE",
      rebuildRequired: false,
      lastSeenAt: new Date("2026-05-03T10:00:00.000Z"),
      conflicts: [{ id: "c1" }],
    });
    prisma.desktopDevice.update.mockResolvedValue({
      id: "device-1",
      clientVersion: "1.0.0",
      workspaceId: "default",
      status: "RESTRICTED",
      rebuildRequired: true,
      lastSeenAt: new Date("2026-05-03T10:00:00.000Z"),
      conflicts: [{ id: "c1" }],
    });

    const { res } = await invokeRoute(route, "patch", "/desktop-devices/:id", {
      params: { id: "device-1" },
      body: { status: "RESTRICTED", rebuildRequired: true },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.desktopDevice.update).toHaveBeenCalledWith({
      where: { id: "device-1" },
      data: { status: "RESTRICTED", rebuildRequired: true },
      include: { conflicts: true },
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ action: "Updated desktop device" }));
  });
});
