import { spawn } from "node:child_process";

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
  console.log("Running release verification: tests, build, and live smoke");
  await run("npm", ["test"]);
  await run("npm", ["run", "build"]);
  await run("npm", ["run", "verify:production"]);
  console.log("Release verification passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
