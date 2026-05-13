import { spawn } from "node:child_process";

export function validateReleaseEnv(env = process.env) {
  const missing = ["APP_URL", "SMOKE_EMAIL", "SMOKE_PASSWORD"].filter((key) => !String(env[key] ?? "").trim());
  if (missing.length) {
    throw new Error(`Missing required release env: ${missing.join(", ")}`);
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });

    child.on("error", reject);
  });
}

async function main() {
  validateReleaseEnv();
  console.log("Running release verification: lint, tests, build, and live smoke");
  await run("npm", ["run", "lint"]);
  await run("npm", ["test"]);
  await run("npm", ["run", "build"]);
  await run("npm", ["run", "verify:production"]);
  console.log("Release verification passed");
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1]) && !process.env.VITEST;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
