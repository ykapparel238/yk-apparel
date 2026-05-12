import { pathToFileURL } from "node:url";

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonResponse(response, label) {
  return response.json().catch(() => {
    throw new Error(`${label} returned invalid JSON`);
  });
}

export function reconcileReleaseData({ dashboard, orders, orderStatusRows, managementRows, mrpItems, mrpReportRows }) {
  const orderRows = orders.items ?? [];
  const management = managementRows[0] ?? null;
  const dashboardKpis = dashboard.kpis ?? {};

  const totalOrders = orderRows.length;
  const unitsPlanned = orderRows.reduce((sum, row) => sum + toNumber(row.qty), 0);
  const unitsCompleted = orderRows.reduce((sum, row) => sum + toNumber(row.delivered), 0);
  const delayedOrders = orderRows.filter((row) => row.status === "Delayed").length;
  const mrpShortageTotal = mrpItems.reduce((sum, item) => sum + toNumber(item.shortage), 0);
  const mrpReportShortageTotal = mrpReportRows.reduce((sum, row) => sum + toNumber(row.shortage), 0);

  assert(orderStatusRows.length === totalOrders, `Order status report row count mismatch: expected ${totalOrders}, got ${orderStatusRows.length}`);
  assert(dashboardKpis.totalOrders === totalOrders, `Dashboard totalOrders mismatch: expected ${totalOrders}, got ${dashboardKpis.totalOrders}`);
  assert(dashboardKpis.unitsPlanned === unitsPlanned, `Dashboard unitsPlanned mismatch: expected ${unitsPlanned}, got ${dashboardKpis.unitsPlanned}`);
  assert(dashboardKpis.unitsCompleted === unitsCompleted, `Dashboard unitsCompleted mismatch: expected ${unitsCompleted}, got ${dashboardKpis.unitsCompleted}`);
  assert(dashboardKpis.delayedOrders === delayedOrders, `Dashboard delayedOrders mismatch: expected ${delayedOrders}, got ${dashboardKpis.delayedOrders}`);

  assert(Boolean(management), "Management summary report is empty");
  assert(toNumber(management.totalOrders) === totalOrders, `Management summary totalOrders mismatch: expected ${totalOrders}, got ${management.totalOrders}`);
  assert(toNumber(management.unitsPlanned) === unitsPlanned, `Management summary unitsPlanned mismatch: expected ${unitsPlanned}, got ${management.unitsPlanned}`);
  assert(toNumber(management.unitsDelivered) === unitsCompleted, `Management summary unitsDelivered mismatch: expected ${unitsCompleted}, got ${management.unitsDelivered}`);

  assert(mrpItems.length === mrpReportRows.length, `MRP row count mismatch: expected ${mrpItems.length}, got ${mrpReportRows.length}`);
  assert(Number(mrpShortageTotal.toFixed(2)) === Number(mrpReportShortageTotal.toFixed(2)), `MRP shortage total mismatch: expected ${mrpShortageTotal.toFixed(2)}, got ${mrpReportShortageTotal.toFixed(2)}`);
}

export async function runProductionSmoke({
  baseUrl = process.env.APP_URL || "http://127.0.0.1:4000",
  email = process.env.SMOKE_EMAIL || "rohit@knitcraft.in",
  password = process.env.SMOKE_PASSWORD || "demo1234",
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  assert(typeof fetchImpl === "function", "Fetch is not available in this runtime");

  const request = async (path, init, label) => {
    const response = await fetchImpl(`${baseUrl}${path}`, init);
    assert(response.ok, `${label} failed with ${response.status}`);
    return response;
  };

  await request("/api/health", undefined, "Health check");
  log("OK /api/health");

  await request("/api/health/db", undefined, "DB readiness check");
  log("OK /api/health/db");

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, "Login");
  log("OK /api/auth/login");

  const cookie = login.headers.get("set-cookie");
  assert(cookie, "Login did not return session cookie");
  const sessionCookie = cookie.split(";")[0];

  const authedGet = async (path, label, expectJson = true) => {
    const response = await request(path, { headers: { cookie: sessionCookie } }, label);
    return expectJson ? parseJsonResponse(response, label) : response;
  };

  await authedGet("/api/auth/session", "Session check");
  log("OK /api/auth/session");

  await authedGet("/api/masters/summary", "Masters summary");
  log("OK /api/masters/summary");

  const mastersSummary = await authedGet("/api/masters/summary", "Masters summary reload");
  const firstStyle = mastersSummary.styles?.[0];
  if (firstStyle?.id) {
    await authedGet(`/api/masters/styles/${firstStyle.id}/tech-pack`, "Style tech pack");
    log("OK /api/masters/styles/:id/tech-pack");
  }

  const orders = await authedGet("/api/orders", "Orders list");
  log("OK /api/orders");

  const dashboard = await authedGet("/api/dashboard", "Dashboard");
  log("OK /api/dashboard");

  const reports = await authedGet("/api/reports", "Reports summary");
  log("OK /api/reports");

  const orderStatusReport = await authedGet("/api/reports/order-status-report", "Order status report");
  log("OK /api/reports/order-status-report");

  const managementSummary = await authedGet("/api/reports/management-summary", "Management summary report");
  log("OK /api/reports/management-summary");

  const mrp = await authedGet("/api/mrp", "MRP");
  log("OK /api/mrp");

  await authedGet("/api/inventory/purchase-orders", "Supplier purchase orders");
  log("OK /api/inventory/purchase-orders");

  await authedGet("/api/production/entries", "Production entries");
  log("OK /api/production/entries");

  await authedGet("/api/qa/capa", "QA CAPA");
  log("OK /api/qa/capa");

  const mrpReport = await authedGet("/api/reports/material-requirement-planning", "MRP report");
  log("OK /api/reports/material-requirement-planning");

  reconcileReleaseData({
    dashboard,
    orders,
    orderStatusRows: orderStatusReport.rows ?? [],
    managementRows: managementSummary.rows ?? [],
    mrpItems: mrp.items ?? [],
    mrpReportRows: mrpReport.rows ?? [],
  });
  log("OK release reconciliation");

  const csvResponse = await authedGet("/api/reports/order-status-report.csv", "CSV export", false);
  const csvText = await csvResponse.text();
  assert(csvResponse.headers.get("content-type")?.includes("text/csv"), "CSV export did not return text/csv");
  assert(csvText.includes("poNumber"), "CSV export did not include expected header");
  log("OK /api/reports/order-status-report.csv");

  const pdfResponse = await authedGet("/api/reports/order-status-report.pdf", "PDF export", false);
  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
  assert(pdfResponse.headers.get("content-type")?.includes("application/pdf"), "PDF export did not return application/pdf");
  assert(pdfBuffer.subarray(0, 4).toString("utf8") === "%PDF", "PDF export did not include a valid PDF signature");
  log("OK /api/reports/order-status-report.pdf");

  log("Production smoke checks passed");
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runProductionSmoke().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
