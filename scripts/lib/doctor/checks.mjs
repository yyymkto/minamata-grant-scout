import {
  DOCTOR_REQUIRED_GENERATED_APP_PATHS,
  DOCTOR_REQUIRED_RUNTIME_PATHS,
  EXAMPLE_RESIDUE_PATHS,
  GENERATED_APP_REMOVED_PATHS,
  README_PATTERNS,
  STARTER_ONLY_SCRIPTS,
} from "../starter-catalog.mjs";
import { buildDoctorContext } from "./context.mjs";

function createCheck(level, code, message) {
  return { level, code, message };
}

function buildStarterRepoCheck(context) {
  if (!context.isStarterRepo) {
    return null;
  }

  return createCheck("info", "starter_repo_detected", "Starter repository detected; generated-app checks are skipped.");
}

function buildPackageIdentityChecks(context) {
  if (context.packageName === "create-cf-starter") {
    return [
      createCheck("fail", "package_name_not_rewritten", "package.json name is still create-cf-starter."),
    ];
  }

  return [
    createCheck("pass", "package_name", `package.json name is ${context.packageName}.`),
  ];
}

function buildStarterResidueChecks(context) {
  const starterPaths = GENERATED_APP_REMOVED_PATHS.filter((filePath) => context.pathSet.has(filePath));
  const starterScripts = STARTER_ONLY_SCRIPTS.filter((scriptName) => scriptName in context.scripts);
  const readmeHits = README_PATTERNS.filter((pattern) => context.readme.includes(pattern));

  return [
    starterPaths.length > 0
      ? createCheck("fail", "starter_files_present", `Starter-only files remain: ${starterPaths.join(", ")}`)
      : createCheck("pass", "starter_files_absent", "Starter-only files are not present."),
    starterScripts.length > 0
      ? createCheck("fail", "starter_scripts_present", `Starter-only npm scripts remain: ${starterScripts.join(", ")}`)
      : createCheck("pass", "starter_scripts_absent", "Starter-only npm scripts are not present."),
    readmeHits.length > 0
      ? createCheck("fail", "starter_readme_residue", `README still mentions starter-only commands: ${readmeHits.join(", ")}`)
      : createCheck("pass", "readme_clean", "README does not mention starter-only commands."),
  ];
}

function buildGeneratedAppCompletenessChecks(context) {
  const missingGeneratedAppPaths = DOCTOR_REQUIRED_GENERATED_APP_PATHS.filter((filePath) => !context.pathSet.has(filePath));
  const missingRuntimeSupportPaths = DOCTOR_REQUIRED_RUNTIME_PATHS.filter((filePath) => !context.pathSet.has(filePath));
  const missingAppScripts = ["doctor", "seed:demo"].filter((scriptName) => !(scriptName in context.scripts));

  return [
    missingGeneratedAppPaths.length > 0
      ? createCheck("fail", "missing_generated_app_paths", `Missing generated-app paths: ${missingGeneratedAppPaths.join(", ")}`)
      : createCheck("pass", "generated_app_paths_present", "Template-root generated-app paths are present."),
    missingRuntimeSupportPaths.length > 0
      ? createCheck("fail", "missing_generated_app_runtime", `Missing generated-app runtime files: ${missingRuntimeSupportPaths.join(", ")}`)
      : createCheck("pass", "generated_app_runtime_present", "Generated-app runtime scripts are present."),
    missingAppScripts.length > 0
      ? createCheck("fail", "missing_app_scripts", `Missing app-ready scripts: ${missingAppScripts.join(", ")}`)
      : createCheck("pass", "app_scripts_present", "doctor and seed:demo scripts are present."),
  ];
}

function buildExampleFeatureChecks(context) {
  const checks = [];
  const exampleResidue = EXAMPLE_RESIDUE_PATHS.filter((filePath) => context.pathSet.has(filePath));

  if (context.selectedExampleFeatures.length === 0) {
    checks.push(
      exampleResidue.length > 0
        ? createCheck("fail", "example_residue_present", `Example directories remain in a core-first app: ${exampleResidue.join(", ")}`)
        : createCheck("pass", "example_residue_absent", "No optional example directories remain.")
    );
  } else {
    checks.push(
      createCheck("pass", "selected_examples_detected", `Detected optional examples: ${context.selectedExampleFeatures.join(", ")}.`)
    );

    if (!context.pathSet.has("examples")) {
      checks.push(
        createCheck("fail", "examples_root_missing", "Optional examples are present, but the examples/ root directory is missing.")
      );
    }
  }

  if (context.selectedExampleFeatures.includes("items")) {
    checks.push(
      context.itemsMigrationPresent
        ? createCheck("pass", "items_migration_present", "items example migration is materialized in migrations/.")
        : createCheck("fail", "items_migration_missing", "items example is present, but migrations/0010_example_items.sql is missing.")
    );
  } else if (context.itemsMigrationPresent) {
    checks.push(
      createCheck("fail", "items_migration_residue", "migrations/0010_example_items.sql remains even though the items example is not present.")
    );
  }

  return checks;
}

function buildWranglerBindingChecks(context) {
  const checks = [];

  if (context.selectedExampleFeatures.includes("kv")) {
    checks.push(
      context.hasKvBinding
        ? createCheck("pass", "kv_binding_present", "KV binding is present for the kv example.")
        : createCheck("fail", "kv_binding_missing", "kv example is present, but wrangler.jsonc has no KV binding.")
    );
  } else if (context.hasKvBinding) {
    checks.push(
      createCheck("fail", "kv_binding_residue", "wrangler.jsonc still has a KV binding even though the kv example is not present.")
    );
  }

  if (context.selectedExampleFeatures.includes("upload")) {
    checks.push(
      context.hasBucketBinding
        ? createCheck("pass", "bucket_binding_present", "R2 binding is present for the upload example.")
        : createCheck("fail", "bucket_binding_missing", "upload example is present, but wrangler.jsonc has no R2 binding.")
    );
  } else if (context.hasBucketBinding) {
    checks.push(
      createCheck("fail", "bucket_binding_residue", "wrangler.jsonc still has an R2 binding even though the upload example is not present.")
    );
  }

  const primaryDatabase = context.wranglerConfig?.d1_databases?.[0];
  checks.push(
    !primaryDatabase?.database_id || primaryDatabase.database_id === "TODO"
      ? createCheck("warn", "database_id_todo", "wrangler.jsonc still has TODO for d1 database_id.")
      : createCheck("pass", "database_id_set", "wrangler.jsonc has a concrete d1 database_id.")
  );

  const vars = context.wranglerConfig?.vars ?? {};
  if (typeof vars.EMAIL_FROM === "string" && vars.EMAIL_FROM.includes("cf-starter")) {
    checks.push(createCheck("warn", "email_from_default", "EMAIL_FROM still contains cf-starter."));
  }

  return checks;
}

export function analyzeGeneratedApp(input) {
  const context = buildDoctorContext(input);
  const starterRepoCheck = buildStarterRepoCheck(context);

  if (starterRepoCheck) {
    return { ok: true, checks: [starterRepoCheck], skipped: true };
  }

  const checks = [
    ...buildPackageIdentityChecks(context),
    ...buildStarterResidueChecks(context),
    ...buildGeneratedAppCompletenessChecks(context),
    ...buildExampleFeatureChecks(context),
    ...buildWranglerBindingChecks(context),
  ];

  return {
    ok: !checks.some((check) => check.level === "fail"),
    checks,
    skipped: false,
  };
}
