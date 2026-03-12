import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function listFeatureMigrations(sourceDir, selectedFeatures = []) {
  const migrations = [];

  for (const feature of selectedFeatures) {
    const migrationsDir = join(sourceDir, "examples/feature-packs", feature, "migrations");
    if (!(await pathExists(migrationsDir))) continue;

    const entries = (await readdir(migrationsDir)).filter((entry) => entry.endsWith(".sql")).sort();
    for (const entry of entries) {
      migrations.push({
        feature,
        filename: entry,
        sourcePath: join(migrationsDir, entry),
      });
    }
  }

  return migrations;
}

export async function materializeFeatureMigrations({
  sourceDir,
  targetDir,
  selectedFeatures = [],
  skipExisting = false,
} = {}) {
  const migrations = await listFeatureMigrations(sourceDir, selectedFeatures);
  if (migrations.length === 0) {
    return [];
  }

  const targetMigrationsDir = join(targetDir, "migrations");
  await mkdir(targetMigrationsDir, { recursive: true });

  const copied = [];
  for (const migration of migrations) {
    const destinationPath = join(targetMigrationsDir, migration.filename);
    if (skipExisting && (await pathExists(destinationPath))) {
      continue;
    }
    await cp(migration.sourcePath, destinationPath);
    copied.push(join("migrations", basename(destinationPath)));
  }

  return copied;
}

