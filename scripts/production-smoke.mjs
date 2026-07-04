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

export function reconcileOperationalReports({
  purchaseOrders,
  procurementRows,
  productionEntries,
  productionRows,
  capaItems,
  capaRows,
  styleTechPack,
  techPackRows,
}) {
  const poItems = purchaseOrders.items ?? [];
  const entryItems = productionEntries.items ?? [];
  const capaList = capaItems.items ?? [];
  const styleAssets = styleTechPack.assets ?? [];
  const styleSamples = styleTechPack.samples ?? [];
  const styleMeasurements = styleTechPack.measurements ?? [];
  const styleThreadSpecs = styleTechPack.threadSpecs ?? [];

  const poOrderedTotal = poItems.reduce((sum, item) => sum + toNumber(item.orderedQty), 0);
  const procurementOrderedTotal = procurementRows.reduce((sum, row) => sum + toNumber(row.orderedQty), 0);
  const poReceivedTotal = poItems.reduce((sum, item) => sum + toNumber(item.receivedQty), 0);
  const procurementReceivedTotal = procurementRows.reduce((sum, row) => sum + toNumber(row.receivedQty), 0);

  const productionActualTotal = entryItems.reduce((sum, item) => sum + toNumber(item.actualQty), 0);
  const productionReportActualTotal = productionRows.reduce((sum, row) => sum + toNumber(row.actualQty), 0);
  const productionRejectedTotal = entryItems.reduce((sum, item) => sum + toNumber(item.rejectedQty), 0);
  const productionReportRejectedTotal = productionRows.reduce((sum, row) => sum + toNumber(row.rejectedQty), 0);

  const openCapas = capaList.filter((item) => item.status !== "CLOSED").length;
  const openCapaRows = capaRows.filter((row) => row.status !== "Closed").length;

  assert(procurementRows.length === poItems.length, `Procurement report row count mismatch: expected ${poItems.length}, got ${procurementRows.length}`);
  assert(Number(poOrderedTotal.toFixed(2)) === Number(procurementOrderedTotal.toFixed(2)), `Procurement ordered total mismatch: expected ${poOrderedTotal.toFixed(2)}, got ${procurementOrderedTotal.toFixed(2)}`);
  assert(Number(poReceivedTotal.toFixed(2)) === Number(procurementReceivedTotal.toFixed(2)), `Procurement received total mismatch: expected ${poReceivedTotal.toFixed(2)}, got ${procurementReceivedTotal.toFixed(2)}`);

  assert(productionRows.length === entryItems.length, `Production report row count mismatch: expected ${entryItems.length}, got ${productionRows.length}`);
  assert(productionActualTotal === productionReportActualTotal, `Production actual total mismatch: expected ${productionActualTotal}, got ${productionReportActualTotal}`);
  assert(productionRejectedTotal === productionReportRejectedTotal, `Production rejected total mismatch: expected ${productionRejectedTotal}, got ${productionReportRejectedTotal}`);

  assert(capaRows.length === capaList.length, `CAPA report row count mismatch: expected ${capaList.length}, got ${capaRows.length}`);
  assert(openCapas === openCapaRows, `Open CAPA mismatch: expected ${openCapas}, got ${openCapaRows}`);

  const techPackRow = techPackRows.find((row) => row.styleCode === styleTechPack.styleCode || row.styleCode === styleTechPack.style?.code);
  assert(Boolean(techPackRow), "Style tech pack report is missing the seeded style row");
  assert(toNumber(techPackRow.assetCount) === styleAssets.length, `Tech pack asset count mismatch: expected ${styleAssets.length}, got ${techPackRow.assetCount}`);
  assert(toNumber(techPackRow.sampleCount) === styleSamples.length, `Tech pack sample count mismatch: expected ${styleSamples.length}, got ${techPackRow.sampleCount}`);
  assert(toNumber(techPackRow.measurementCount) === styleMeasurements.length, `Tech pack measurement count mismatch: expected ${styleMeasurements.length}, got ${techPackRow.measurementCount}`);
  assert(toNumber(techPackRow.threadSpecCount) === styleThreadSpecs.length, `Tech pack thread spec count mismatch: expected ${styleThreadSpecs.length}, got ${techPackRow.threadSpecCount}`);
}

export async function runProductionSmoke({
  baseUrl = process.env.APP_URL || "http://127.0.0.1:4000",
  email = process.env.SMOKE_EMAIL || "rohit@ykapparels.in",
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
  let styleTechPack = null;
  if (firstStyle?.id) {
    styleTechPack = await authedGet(`/api/masters/styles/${firstStyle.id}/tech-pack`, "Style tech pack");
    log("OK /api/masters/styles/:id/tech-pack");
    const firstAsset = styleTechPack.assets?.[0];
    if (firstAsset?.id) {
      await authedGet(`/api/assets/${firstAsset.id}`, "Asset metadata");
      log("OK /api/assets/:id");
    }
  }

  const orders = await authedGet("/api/orders", "Orders list");
  log("OK /api/orders");
  const firstOrder = orders.items?.[0];
  if (firstOrder?.id) {
    const orderDetail = await authedGet(`/api/orders/${firstOrder.id}`, "Order detail");
    assert(orderDetail.techPack, "Order detail did not include tech pack payload");
    log("OK /api/orders/:id");
  }

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

  const purchaseOrders = await authedGet("/api/inventory/purchase-orders", "Supplier purchase orders");
  log("OK /api/inventory/purchase-orders");

  const productionEntries = await authedGet("/api/production/entries", "Production entries");
  log("OK /api/production/entries");

  const capaItems = await authedGet("/api/qa/capa", "QA CAPA");
  log("OK /api/qa/capa");

  const mrpReport = await authedGet("/api/reports/material-requirement-planning", "MRP report");
  log("OK /api/reports/material-requirement-planning");
  const procurementReport = await authedGet("/api/reports/procurement-status-report", "Procurement report");
  log("OK /api/reports/procurement-status-report");
  const productionReport = await authedGet("/api/reports/production-actuals-report", "Production actuals report");
  log("OK /api/reports/production-actuals-report");
  const capaReport = await authedGet("/api/reports/capa-closure-report", "CAPA report");
  log("OK /api/reports/capa-closure-report");
  const techPackReport = await authedGet("/api/reports/style-tech-pack-register", "Style tech pack report");
  log("OK /api/reports/style-tech-pack-register");

  reconcileReleaseData({
    dashboard,
    orders,
    orderStatusRows: orderStatusReport.rows ?? [],
    managementRows: managementSummary.rows ?? [],
    mrpItems: mrp.items ?? [],
    mrpReportRows: mrpReport.rows ?? [],
  });
  log("OK release reconciliation");
  if (styleTechPack) {
    reconcileOperationalReports({
      purchaseOrders,
      procurementRows: procurementReport.rows ?? [],
      productionEntries,
      productionRows: productionReport.rows ?? [],
      capaItems,
      capaRows: capaReport.rows ?? [],
      styleTechPack: {
        ...styleTechPack,
        styleCode: firstStyle?.code ?? "",
      },
      techPackRows: techPackReport.rows ?? [],
    });
    log("OK operational report reconciliation");
  }

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
