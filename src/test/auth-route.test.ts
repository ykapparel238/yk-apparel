import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateUser = vi.fn();
const createSession = vi.fn();
const destroySession = vi.fn();
const findSessionUser = vi.fn();
const getSessionCookieName = vi.fn(() => "kc_session");
const getSessionCookieOptions = vi.fn(() => ({ httpOnly: true }));
const serializeUser = vi.fn((user) => ({ id: user.id, name: user.name, email: user.email, role: "Admin" }));

vi.mock("../../server/auth.mjs", () => ({
  authenticateUser,
  createSession,
  destroySession,
  findSessionUser,
  getSessionCookieName,
  getSessionCookieOptions,
  serializeUser,
}));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    cookie: vi.fn(),
    clearCookie: vi.fn(),
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
    cookies: {},
    query: {},
    params: {},
    ip: "127.0.0.1",
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

describe("auth route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionCookieName.mockReturnValue("kc_session");
    getSessionCookieOptions.mockReturnValue({ httpOnly: true });
    serializeUser.mockImplementation((user) => ({ id: user.id, name: user.name, email: user.email, role: "Admin" }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("logs in valid users and sets session cookie", async () => {
    const route = (await import("../../server/routes/auth.mjs")).default;
    authenticateUser.mockResolvedValue({ id: "u1", name: "Rohit", email: "rohit@knitcraft.in" });
    createSession.mockResolvedValue({ rawToken: "token-1", expiresAt: new Date("2026-05-01T00:00:00.000Z") });

    const { res } = await invokeRoute(route, "post", "/login", {
      body: { email: "rohit@knitcraft.in", password: "demo1234" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.cookie).toHaveBeenCalledWith("kc_session", "token-1", { httpOnly: true });
    expect(res.body.user).toMatchObject({ id: "u1" });
  });

  it("rejects invalid credentials", async () => {
    const route = (await import("../../server/routes/auth.mjs")).default;
    authenticateUser.mockResolvedValue(null);

    const { res } = await invokeRoute(route, "post", "/login", {
      body: { email: "rohit@knitcraft.in", password: "wrong123" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns active session user", async () => {
    const route = (await import("../../server/routes/auth.mjs")).default;
    findSessionUser.mockResolvedValue({ id: "u1", name: "Rohit", email: "rohit@knitcraft.in" });

    const { res } = await invokeRoute(route, "get", "/session", {
      cookies: { kc_session: "token-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toMatchObject({ id: "u1" });
  });

  it("logs out and clears cookie", async () => {
    const route = (await import("../../server/routes/auth.mjs")).default;

    const { res } = await invokeRoute(route, "post", "/logout", {
      cookies: { kc_session: "token-1" },
    });

    expect(destroySession).toHaveBeenCalledWith("token-1");
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
  });
});
