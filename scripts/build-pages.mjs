// Static export for GitHub Pages. Route handlers can't be statically exported, so the
// /api folder is moved aside for the duration of the build and always restored afterwards.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const api = "src/app/api";
const parked = ".pages-build-api";

if (existsSync(parked)) {
  console.error(`${parked} exists from an interrupted build — move it back to ${api} first.`);
  process.exit(1);
}

renameSync(api, parked);
let status = 1;
try {
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: { ...process.env, GITHUB_PAGES: "true" },
    shell: process.platform === "win32",
  });
  status = r.status ?? 1;
} finally {
  renameSync(parked, api);
}
process.exit(status);
