import {
  OPTIONAL_EXAMPLE_PATHS,
  STARTER_REPO_SENTINEL_PATH,
  normalizeCatalogPath,
} from "../starter-catalog.mjs";

function detectSelectedExampleFeatures(pathSet) {
  return Object.entries(OPTIONAL_EXAMPLE_PATHS)
    .filter(([, candidatePaths]) =>
      candidatePaths.some((candidatePath) => pathSet.has(normalizeCatalogPath(candidatePath)))
    )
    .map(([featureKey]) => featureKey);
}

export function buildDoctorContext({
  packageJson,
  readme = "",
  wranglerConfig = {},
  existingPaths = [],
}) {
  const pathSet = new Set(existingPaths.map(normalizeCatalogPath));
  const scripts = packageJson?.scripts ?? {};
  const packageName = packageJson?.name ?? "";
  const selectedExampleFeatures = detectSelectedExampleFeatures(pathSet);

  return {
    packageJson,
    readme,
    wranglerConfig,
    existingPaths,
    pathSet,
    scripts,
    packageName,
    selectedExampleFeatures,
    itemsMigrationPresent: pathSet.has("migrations/0010_example_items.sql"),
    hasKvBinding: Array.isArray(wranglerConfig?.kv_namespaces) && wranglerConfig.kv_namespaces.length > 0,
    hasBucketBinding: Array.isArray(wranglerConfig?.r2_buckets) && wranglerConfig.r2_buckets.length > 0,
    isStarterRepo: packageName === "create-cf-starter" && pathSet.has(STARTER_REPO_SENTINEL_PATH),
  };
}
