import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { readWranglerConfig } from "../wrangler-config.mjs";
import {
  DOCTOR_REQUIRED_GENERATED_APP_PATHS,
  DOCTOR_REQUIRED_RUNTIME_PATHS,
  GENERATED_APP_TRACKED_PATHS,
} from "../starter-catalog.mjs";
import { analyzeGeneratedApp } from "./checks.mjs";
import { buildDoctorReport } from "./report.mjs";

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function parseDoctorCliArgs(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      json: { type: "boolean" },
    },
  });

  return {
    json: values.json ?? false,
  };
}

export function buildDoctorTrackedPaths() {
  return Array.from(
    new Set([
      ...GENERATED_APP_TRACKED_PATHS,
      ...DOCTOR_REQUIRED_GENERATED_APP_PATHS,
      ...DOCTOR_REQUIRED_RUNTIME_PATHS,
    ])
  );
}

export async function collectExistingPaths(cwd, trackedPaths = buildDoctorTrackedPaths()) {
  const existingPaths = [];
  for (const relativePath of trackedPaths) {
    if (await pathExists(resolve(cwd, relativePath))) {
      existingPaths.push(relativePath);
    }
  }

  return existingPaths;
}

export async function collectDoctorInputs(cwd) {
  const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8"));
  const readmePath = resolve(cwd, "README.md");
  const readme = (await pathExists(readmePath)) ? await readFile(readmePath, "utf8") : "";
  const { config: wranglerConfig } = await readWranglerConfig(cwd);
  const existingPaths = await collectExistingPaths(cwd);

  return {
    packageJson,
    readme,
    wranglerConfig,
    existingPaths,
  };
}

export function emitDoctorResult(result, options) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const report = buildDoctorReport(result);
  for (const line of report.lines) {
    console.log(line);
  }
}

export async function runDoctor(cwd = process.cwd()) {
  return analyzeGeneratedApp(await collectDoctorInputs(cwd));
}
