const baseUrl = process.env.APP_URL || "http://127.0.0.1:4000";
const email = process.env.SMOKE_EMAIL || "rohit@knitcraft.in";
const password = process.env.SMOKE_PASSWORD || "demo1234";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const health = await fetch(`${baseUrl}/api/health`);
  assert(health.ok, "Health check failed");

  const db = await fetch(`${baseUrl}/api/health/db`);
  assert(db.ok, "DB readiness check failed");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert(login.ok, "Login failed");

  const cookie = login.headers.get("set-cookie");
  assert(cookie, "Login did not return session cookie");
  const sessionCookie = cookie.split(";")[0];

  const authedGet = async (path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: sessionCookie },
    });
    assert(response.ok, `${path} failed with ${response.status}`);
    return response.json();
  };

  await authedGet("/api/masters/summary");
  await authedGet("/api/orders");
  await authedGet("/api/dashboard");
  await authedGet("/api/reports");

  console.log("Production smoke checks passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
