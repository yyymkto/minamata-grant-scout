import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { getPrimaryD1DatabaseName, readWranglerConfig } from "./lib/wrangler-config.mjs";
import { materializeFeatureMigrations } from "./lib/example-migrations.mjs";

const mode = process.argv[2] === "remote" ? "--remote" : "--local";
const cwd = process.cwd();
const { config } = await readWranglerConfig();
const dbName = getPrimaryD1DatabaseName(config);
if (!dbName) {
  console.error("d1_databases[0].database_name not found in wrangler.jsonc");
  process.exit(1);
}

const tempDir = await mkdtemp(join(tmpdir(), "cf-starter-migrations-"));

try {
  await cp(resolve(cwd, "wrangler.jsonc"), join(tempDir, "wrangler.jsonc"));
  await cp(resolve(cwd, "migrations"), join(tempDir, "migrations"), { recursive: true });

  const selectedFeatures = ["items", "kv", "upload"];
  await materializeFeatureMigrations({
    sourceDir: cwd,
    targetDir: tempDir,
    selectedFeatures,
    skipExisting: true,
  });

  const args = ["d1", "migrations", "apply", dbName, mode];
  const result = spawnSync("wrangler", args, { stdio: "inherit", cwd: tempDir });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
