import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  department: { findMany: vi.fn() },
  shift: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn() },
};

vi.mock("../../server/db.mjs", () => ({ prisma }));
vi.mock("../../server/audit.mjs", () => ({ writeAuditLog: vi.fn() }));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function invokeRoute(router) {
  const layer = router.stack.find((entry) => entry.route?.path === "/" && entry.route.methods.get);
  const req = { body: {}, query: {}, params: {}, sessionUser: { id: "u1", role: "ADMIN" } };
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
  return res;
}

describe("settings read route", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("returns list payload with departments shifts users and audit log", async () => {
    const route = (await import("../../server/routes/settings.mjs")).default;
    prisma.department.findMany.mockResolvedValue([{ id: "dep-1", code: "D01", name: "Knitting", headName: "Head", staffCount: 10, lineCount: 2 }]);
    prisma.shift.findMany.mockResolvedValue([{ id: "shift-1", code: "A", name: "Shift A", startTime: "06:00", endTime: "14:00", supervisorName: "Sup", headcount: 20 }]);
    prisma.user.findMany.mockResolvedValue([{ id: "u1", employeeCode: "EMP-1", name: "Rohit", email: "r@test.com", role: "ADMIN", status: "ACTIVE", departmentId: "dep-1", shiftId: "shift-1", lastActiveAt: new Date("2026-04-20T10:00:00.000Z") }]);
    prisma.auditLog.findMany.mockResolvedValue([{ id: "a1", occurredAt: new Date("2026-04-20T10:00:00.000Z"), actor: { name: "Rohit" }, action: "Updated", targetLabel: "Knitting", module: "Settings" }]);

    const res = await invokeRoute(route);

    expect(res.statusCode).toBe(200);
    expect(res.body.departments).toHaveLength(1);
    expect(res.body.shifts).toHaveLength(1);
    expect(res.body.users[0]).toMatchObject({ id: "EMP-1", departmentCode: "D01", shiftCode: "A" });
    expect(res.body.auditLog).toHaveLength(1);
  });
});
