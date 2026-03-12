export const STARTER_REPO_SENTINEL_PATH = "bin/create-cf-starter";

export const GENERATED_APP_REMOVED_PATHS = Object.freeze([
  "bin/create-cf-starter",
  "scripts/check-publish-ready.mjs",
  "scripts/compat/app-plan.mjs",
  "scripts/compat/modules-plan.mjs",
  "scripts/compat/scaffold-app.mjs",
  "scripts/create-cf-starter.mjs",
  "scripts/internal/check-template-directory.mjs",
  "scripts/internal/app-plan.mjs",
  "scripts/internal/materialize-template-candidate.mjs",
  "scripts/internal/modules-plan.mjs",
  "scripts/internal/scaffold-app.mjs",
  "scripts/internal/snapshot-template.mjs",
  "scripts/internal/template-report-cli.mjs",
  "scripts/internal/sync-template-directory.mjs",
  "scripts/internal/template-cli-options.mjs",
  "scripts/lib/app-plan.mjs",
  "scripts/lib/cli-args.mjs",
  "scripts/lib/scaffold/orchestrator.mjs",
  "scripts/lib/scaffold/planner.mjs",
  "scripts/lib/scaffold/renderers/app-template.mjs",
  "scripts/lib/scaffold/renderers/readme.mjs",
  "scripts/lib/scaffold/renderers/workflow.mjs",
  "scripts/lib/scaffold/transforms/cleanup.mjs",
  "scripts/lib/scaffold/transforms/app-metadata.mjs",
  "scripts/lib/scaffold/transforms/file-ops.mjs",
  "scripts/lib/scaffold/transforms/feature-selection.mjs",
  "scripts/lib/scaffold/transforms/helpers.mjs",
  "scripts/lib/scaffold/transforms/index-selection.mjs",
  "scripts/lib/scaffold/transforms/items-selection.mjs",
  "scripts/lib/scaffold/transforms/jsonc.mjs",
  "scripts/lib/scaffold/transforms/metadata.mjs",
  "scripts/lib/scaffold/transforms/package-metadata.mjs",
  "scripts/lib/scaffold/transforms/readme-metadata.mjs",
  "scripts/lib/scaffold/transforms/scaffold-markers.mjs",
  "scripts/lib/scaffold/transforms/wrangler.mjs",
  "scripts/lib/scaffold/transforms/wrangler-metadata.mjs",
  "scripts/lib/modules-plan.mjs",
  "scripts/lib/scaffold.mjs",
  "scripts/lib/deprecation.mjs",
  "scripts/lib/starter-manifest.mjs",
  "scripts/lib/template-candidate.mjs",
  "scripts/lib/template-directory.mjs",
  "scripts/lib/template-snapshot.mjs",
  "scripts/lib/template-manifest.mjs",
  "scripts/lib/template-source.mjs",
  "scripts/test-create.mjs",
  "test/create-cf-starter.test.ts",
  "test/deprecated-cli.test.ts",
  "test/doctor.test.ts",
  "test/module-plan.test.ts",
  "test/public-surface.test.ts",
  "test/scaffold.test.ts",
  "test/starter-manifest.test.ts",
  "test/template-candidate.test.ts",
  "test/template-manifest.test.ts",
  "test/template-snapshot.test.ts",
  "test/fixtures/template-snapshots",
  "ARCHITECTURE.md",
  "CLAUDE.md",
  "ROADMAP.md",
]);

export const GENERATED_APP_REWRITTEN_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
]);

export const STARTER_ONLY_SCRIPTS = Object.freeze([
  "test:create",
  "check:publish",
  "modules:plan",
  "modules:plan:json",
  "app:plan",
  "app:plan:core",
  "app:plan:json",
  "app:plan:core:json",
  "app:scaffold",
]);

export const README_PATTERNS = Object.freeze([
  "create-cf-starter",
  "app:scaffold",
  "modules:plan",
  "app:plan",
]);

export const EXAMPLE_RESIDUE_PATHS = Object.freeze([
  "examples",
  "examples/feature-packs",
  "examples/lib",
]);

export const DOCTOR_REQUIRED_GENERATED_APP_PATHS = Object.freeze([
  ".gitignore",
  ".github/workflows/ci.yml",
  "README.md",
  "app",
  "drizzle.config.ts",
  "index.html",
  "migrations",
  "package.json",
  "shared",
  "src",
  "tsconfig.json",
  "vite.config.split.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "wrangler.jsonc",
]);

export const DOCTOR_REQUIRED_RUNTIME_PATHS = Object.freeze([
  "scripts/d1-migrate.mjs",
  "scripts/doctor.mjs",
  "scripts/generate-record.mjs",
  "scripts/seed-demo.mjs",
  "scripts/lib/doctor.mjs",
  "scripts/lib/doctor/cli.mjs",
  "scripts/lib/doctor/checks.mjs",
  "scripts/lib/doctor/context.mjs",
  "scripts/lib/doctor/report.mjs",
  "scripts/lib/example-migrations.mjs",
  "scripts/lib/record-engine.mjs",
  "scripts/lib/starter-catalog.mjs",
  "scripts/lib/wrangler-config.mjs",
]);

export const OPTIONAL_EXAMPLE_PATHS = Object.freeze({
  items: Object.freeze([
    "examples/feature-packs/items/server",
    "examples/feature-packs/items/app",
    "examples/feature-packs/items/shared",
  ]),
  kv: Object.freeze([
    "examples/feature-packs/kv/server",
  ]),
  upload: Object.freeze([
    "examples/feature-packs/upload/server",
  ]),
});

export const GENERATED_APP_TRACKED_PATHS = Object.freeze([
  ...EXAMPLE_RESIDUE_PATHS,
  ...Object.values(OPTIONAL_EXAMPLE_PATHS).flat(),
  "migrations/0010_example_items.sql",
  ...GENERATED_APP_REMOVED_PATHS,
]);

export const PUBLISH_FORBIDDEN_STARTER_PATHS = Object.freeze([
  "ARCHITECTURE.md",
  "ROADMAP.md",
  "scripts/check-publish-ready.mjs",
  "scripts/test-create.mjs",
  "scripts/compat/app-plan.mjs",
  "scripts/compat/modules-plan.mjs",
  "scripts/compat/scaffold-app.mjs",
  "scripts/internal/check-template-directory.mjs",
  "scripts/internal/app-plan.mjs",
  "scripts/internal/materialize-template-candidate.mjs",
  "scripts/internal/modules-plan.mjs",
  "scripts/internal/snapshot-template.mjs",
  "scripts/internal/template-report-cli.mjs",
  "scripts/internal/sync-template-directory.mjs",
  "scripts/internal/template-cli-options.mjs",
  "scripts/lib/app-plan.mjs",
  "scripts/lib/deprecation.mjs",
  "scripts/lib/modules-plan.mjs",
  "scripts/lib/template-candidate.mjs",
  "scripts/lib/template-directory.mjs",
  "scripts/lib/template-snapshot.mjs",
  "scripts/lib/template-manifest.mjs",
  "test/create-cf-starter.test.ts",
  "test/deprecated-cli.test.ts",
  "test/doctor.test.ts",
  "test/module-plan.test.ts",
  "test/public-surface.test.ts",
  "test/scaffold.test.ts",
  "test/starter-manifest.test.ts",
  "test/template-candidate.test.ts",
  "test/template-manifest.test.ts",
  "test/template-snapshot.test.ts",
  "test/fixtures/template-snapshots",
]);

export const EXAMPLE_FEATURE_KEYS = Object.freeze([
  "items",
  "kv",
  "upload",
]);

export const CORE_REQUIRED_BINDINGS = Object.freeze([
  "DB",
  "JOBS",
  "RATE_LIMITER",
]);

export const CORE_BINDING_REASONS = Object.freeze({
  DB: "Core auth, organizations, sessions, audit logs, and example D1 data use D1.",
  JOBS: "Invite, password reset, email verification, and welcome mail flows enqueue queue jobs.",
  RATE_LIMITER: "Auth rate limiting uses the Durable Object binding.",
});

export const REMOVABLE_BINDING_REASONS = Object.freeze({
  KV: "Only the kv example feature uses the KV binding.",
  BUCKET: "Only the upload example feature uses the R2 bucket binding.",
});

export function normalizeCatalogPath(filePath) {
  return filePath.replace(/\/+$/, "");
}
