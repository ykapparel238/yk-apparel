import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const candidateUrls = (
  process.env.DESKTOP_VITE_DEV_URLS
    ?? "http://127.0.0.1:8080,http://127.0.0.1:8081,http://127.0.0.1:8082"
).split(",").map((item) => item.trim()).filter(Boolean);

async function resolveDevServerUrl(attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    for (const url of candidateUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return url;
        }
      } catch {}
    }
    await wait(1000);
  }

  throw new Error(`Unable to reach any Vite dev server candidate: ${candidateUrls.join(", ")}`);
}

const devServerUrl = await resolveDevServerUrl();

const child = spawn(
  "npx",
  ["electron", "electron/main.cjs"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devServerUrl,
    },
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
