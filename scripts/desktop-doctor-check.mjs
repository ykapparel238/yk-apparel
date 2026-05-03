import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [
  ["Electron main", path.join(root, "electron", "main.cjs")],
  ["Electron preload", path.join(root, "electron", "preload.cjs")],
  ["Desktop dev script", path.join(root, "scripts", "desktop-dev.mjs")],
  ["Sync route", path.join(root, "server", "routes", "sync.mjs")],
  ["Desktop migration", path.join(root, "prisma", "migrations", "0006_desktop_sync", "migration.sql")],
];

const report = checks.map(([label, file]) => ({ label, ok: fs.existsSync(file), file }));
const failed = report.filter((item) => !item.ok);

console.log(JSON.stringify({ ok: failed.length === 0, checks: report }, null, 2));
process.exit(failed.length ? 1 : 0);
