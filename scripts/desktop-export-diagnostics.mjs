import fs from "node:fs";
import path from "node:path";
import { buildDesktopDiagnostics } from "./desktop-runtime-utils.mjs";

const diagnostics = buildDesktopDiagnostics();
const outputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), `desktop-diagnostics-${Date.now()}.json`);

fs.writeFileSync(outputPath, `${JSON.stringify(diagnostics, null, 2)}\n`);

console.log(JSON.stringify({
  ok: diagnostics.ok,
  outputPath,
  dbPath: diagnostics.dbPath,
  deviceId: diagnostics.deviceId ?? null,
  rebuildRequired: diagnostics.rebuildRequired ?? false,
}, null, 2));
