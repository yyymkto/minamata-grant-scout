/**
 * Record Engine — Pure generation logic (testable, no side effects)
 *
 * All functions here are pure: they take input strings/objects and return
 * output strings or results. File I/O is handled by the caller.
 */

// ── String helpers ──────────────────────────────

export function pascalCase(s) {
  return s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}

export function camelCase(s) {
  return s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

export function snakeCase(s) {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, "");
}

// ── Record definition detection ─────────────────

export function findRecordDef(mod) {
  for (const [exportName, val] of Object.entries(mod)) {
    if (val && typeof val === "object" && val.key && val.tableName && val.fields) {
      return { def: val, exportName };
    }
  }
  return null;
}

/**
 * Resolve the expected export name for a record definition.
 * Convention: `${key}Def` (e.g., key "tasks" → "tasksDef").
 * If the actual export name differs, warn and return the actual name.
 */
export function resolveDefExportName(key, actualExportName) {
  const expected = `${key}Def`;
  if (actualExportName !== expected && actualExportName !== "default") {
    return { name: actualExportName, warning: `Export name "${actualExportName}" does not match convention "${expected}". Generated pages will import as "${actualExportName}".` };
  }
  return { name: expected, warning: null };
}

// ── Record definition validation ────────────────

const VALID_FIELD_TYPES = ["text", "number", "date", "select", "relation", "file"];

/**
 * Validate a record definition for referential integrity.
 * Returns an array of error messages (empty = valid).
 * @param {object} def - Record definition object from defineRecord()
 * @returns {string[]}
 */
export function validateRecordDef(def) {
  const errors = [];
  const fieldKeys = Object.keys(def.fields || {});
  const statusFieldName = def.status?.field ? camelCase(def.status.field) : null;

  // Validate field types
  for (const [name, field] of Object.entries(def.fields || {})) {
    if (!VALID_FIELD_TYPES.includes(field.type)) {
      errors.push(`Field "${name}" has invalid type "${field.type}". Valid types: ${VALID_FIELD_TYPES.join(", ")}`);
    }
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      errors.push(`Select field "${name}" must have a non-empty "options" array`);
    }
    if (field.type === "relation" && !field.relatedRecord) {
      errors.push(`Relation field "${name}" must have a "relatedRecord" property`);
    }
  }

  // Validate status
  if (def.status) {
    if (def.status.defaultValue && def.status.options && !def.status.options.includes(def.status.defaultValue)) {
      errors.push(`status.defaultValue "${def.status.defaultValue}" is not in status.options [${def.status.options.join(", ")}]`);
    }
  }

  // Validate listView.columns
  if (def.listView?.columns) {
    for (const col of def.listView.columns) {
      if (!fieldKeys.includes(col) && col !== statusFieldName) {
        errors.push(`listView.columns references unknown field "${col}". Valid fields: ${[...fieldKeys, ...(statusFieldName ? [statusFieldName] : [])].join(", ")}`);
      }
    }
  }

  // Validate formView.sections
  if (def.formView?.sections) {
    for (const section of def.formView.sections) {
      for (const f of section.fields || []) {
        if (!fieldKeys.includes(f)) {
          errors.push(`formView section "${section.label}" references unknown field "${f}". Valid fields: ${fieldKeys.join(", ")}`);
        }
      }
    }
  }

  return errors;
}

// ── Duplicate detection ─────────────────────────

/**
 * Check whether schema.ts already contains the given table.
 * Matches both `export const tableVar =` and `sqliteTable("tableName"`.
 */
export function schemaHasTable(schemaContent, tableName) {
  const tableVar = camelCase(tableName);
  return (
    schemaContent.includes(`export const ${tableVar}`) ||
    schemaContent.includes(`sqliteTable("${tableName}"`)
  );
}

/**
 * Check whether index.ts already has a route for the given key.
 */
export function indexHasRoute(indexContent, key) {
  return (
    indexContent.includes(`"/api/${key}"`) ||
    indexContent.includes(`'/api/${key}'`)
  );
}

// ── 1. Drizzle table generation ─────────────────

export function generateDrizzleColumn(name, field) {
  const col = snakeCase(name);
  const notNull = field.required ? ".notNull()" : "";
  const defaultVal =
    field.defaultValue !== undefined
      ? `.default(${typeof field.defaultValue === "string" ? `"${field.defaultValue}"` : field.defaultValue})`
      : "";

  switch (field.type) {
    case "text":
      return `  ${name}: text("${col}")${notNull}${defaultVal}`;
    case "number":
      return `  ${name}: integer("${col}")${notNull}${defaultVal}`;
    case "date":
      return `  ${name}: text("${col}")${notNull}${defaultVal}`;
    case "select":
      return `  ${name}: text("${col}")${notNull}${defaultVal}`;
    case "relation":
      return `  ${name}: integer("${col}")${notNull}`;
    case "file":
      return `  ${name}: text("${col}")${notNull}`;
    default:
      return `  ${name}: text("${col}")${notNull}`;
  }
}

/**
 * Generate the Drizzle table block string for appending to schema.ts.
 * Returns { ok: true, content } or { ok: false, reason }.
 */
export function generateDrizzleTableBlock(def) {
  const fieldEntries = Object.entries(def.fields);
  const TABLE = def.tableName;
  const status = def.status;
  const cols = [];

  cols.push(`  id: integer("id").primaryKey({ autoIncrement: true })`);
  cols.push(
    `  organizationId: integer("organization_id")\n    .notNull()\n    .references(() => organizations.id, {\n      onDelete: "cascade",\n    })`
  );

  for (const [name, field] of fieldEntries) {
    cols.push(generateDrizzleColumn(name, field));
  }

  if (status) {
    cols.push(
      `  ${camelCase(status.field)}: text("${snakeCase(status.field)}").notNull().default("${status.defaultValue}")`
    );
  }

  if (def.softDelete) {
    cols.push(`  deletedAt: text("deleted_at")`);
  }

  cols.push(
    `  createdAt: text("created_at").notNull().default("(datetime('now'))")`
  );
  cols.push(
    `  updatedAt: text("updated_at").notNull().default("(datetime('now'))")`
  );

  const tableVar = camelCase(TABLE);
  const block = `\nexport const ${tableVar} = sqliteTable("${TABLE}", {\n${cols.join(",\n")},\n}, (table) => [index("${TABLE}_organization_id_idx").on(table.organizationId)]);\n`;

  return { ok: true, content: block };
}

/**
 * Append a Drizzle table block to schema content.
 * Returns { ok, content, reason, skipped }.
 */
export function appendDrizzleTable(existingSchema, def) {
  if (schemaHasTable(existingSchema, def.tableName)) {
    return {
      ok: true,
      content: existingSchema,
      skipped: true,
      reason: `Table "${def.tableName}" already exists in schema.ts`,
    };
  }

  const result = generateDrizzleTableBlock(def);
  if (!result.ok) return result;

  // Ensure `index` is imported from drizzle-orm/sqlite-core
  let schema = existingSchema;
  if (!schema.includes("index") || !schema.match(/\bindex\b.*from\s+["']drizzle-orm\/sqlite-core["']/)) {
    schema = schema.replace(
      /(import\s*\{[^}]*)(}\s*from\s*["']drizzle-orm\/sqlite-core["'])/,
      (match, imports, tail) => {
        if (/\bindex\b/.test(imports)) return match;
        return `${imports.trimEnd()}, index ${tail}`;
      }
    );
  }

  // Trim trailing whitespace/newlines for a clean insertion point,
  // then append the block followed by a final newline.
  const trimmed = schema.trimEnd();
  return {
    ok: true,
    content: trimmed + result.content,
    skipped: false,
  };
}

// ── 2. Zod schema generation ────────────────────

export function generateZodField(name, field, forUpdate) {
  let z;
  switch (field.type) {
    case "text":
      z = "z.string()";
      if (field.maxLength) z += `.max(${field.maxLength})`;
      if (field.required && !forUpdate) z += ".min(1)";
      break;
    case "number":
      z = "z.number()";
      if (field.min !== undefined) z += `.min(${field.min})`;
      if (field.max !== undefined) z += `.max(${field.max})`;
      break;
    case "date":
      z = `z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "YYYY-MM-DD format required")`;
      break;
    case "select":
      z = `z.enum([${field.options.map((o) => `"${o}"`).join(", ")}])`;
      break;
    case "relation":
      z = "z.number().int()";
      break;
    case "file":
      z = "z.string()";
      break;
    default:
      z = "z.string()";
  }

  if (forUpdate) {
    z += ".optional()";
  } else if (!field.required) {
    z += ".optional()";
  }

  return z;
}

/**
 * Generate the full Zod schema file content.
 */
export function generateZodSchemaContent(def) {
  const PASCAL = pascalCase(def.key);
  const fieldEntries = Object.entries(def.fields);
  const status = def.status;

  const createFields = [];
  const updateFields = [];

  for (const [name, field] of fieldEntries) {
    const zodType = generateZodField(name, field, false);
    const zodTypeOptional = generateZodField(name, field, true);
    createFields.push(`  ${name}: ${zodType},`);
    updateFields.push(`  ${name}: ${zodTypeOptional},`);
  }

  if (status) {
    const opts = status.options.map((o) => `"${o}"`).join(", ");
    createFields.push(
      `  ${camelCase(status.field)}: z.enum([${opts}]).optional(),`
    );
    updateFields.push(
      `  ${camelCase(status.field)}: z.enum([${opts}]).optional(),`
    );
  }

  return `import { z } from "zod";

export const create${PASCAL}Schema = z.object({
${createFields.join("\n")}
});

export const update${PASCAL}Schema = z.object({
${updateFields.join("\n")}
});

// Cross-field validation hook — add custom refinements here:
// export const create${PASCAL}SchemaRefined = create${PASCAL}Schema.refine(
//   (data) => { /* your cross-field logic */ return true; },
//   { message: "..." }
// );

export type Create${PASCAL}Input = z.infer<typeof create${PASCAL}Schema>;
export type Update${PASCAL}Input = z.infer<typeof update${PASCAL}Schema>;
`;
}

// ── 5. Route registration in index.ts ───────────

/**
 * Insert import and .route() registration into index.ts content.
 * Returns { ok, content, reason, skipped }.
 */
export function insertRouteRegistration(existingIndex, key) {
  // Duplicate check
  if (indexHasRoute(existingIndex, key)) {
    return {
      ok: true,
      content: existingIndex,
      skipped: true,
      reason: `Route "/api/${key}" already registered in src/index.ts`,
    };
  }

  const importLine = `import ${key}Routes from "./features/${key}/routes";`;
  const lines = existingIndex.split("\n");

  // Find the last import statement (supports `import` and `import {`)
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    return {
      ok: false,
      content: existingIndex,
      reason:
        "Could not find any import statements in src/index.ts. The file may be empty or have an unexpected structure.",
    };
  }

  // Insert import after the last import line
  lines.splice(lastImportIndex + 1, 0, importLine);

  // Find the route registration block.
  // Strategy: look for the last `.route(` line that ends with `;` (the chain terminator).
  // We insert our new route BEFORE that line.
  // If no semicolon-terminated .route() exists, fall back to inserting after the last .route().
  let lastRouteSemicolonIndex = -1;
  let lastRouteIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.includes(".route(")) {
      lastRouteIndex = i;
      if (trimmed.endsWith(";")) {
        lastRouteSemicolonIndex = i;
      }
    }
  }

  let routeInsertIndex;
  if (lastRouteSemicolonIndex !== -1) {
    // Insert before the semicolon-terminated .route() line (typically the auth route)
    routeInsertIndex = lastRouteSemicolonIndex;
  } else if (lastRouteIndex !== -1) {
    // Insert after the last .route() line
    routeInsertIndex = lastRouteIndex + 1;
  } else {
    return {
      ok: false,
      content: existingIndex,
      reason:
        "Could not find any .route() registration in src/index.ts. Please add at least one route before running the generator.",
    };
  }

  const routeLine = `  .route("/api/${key}", ${key}Routes)`;
  lines.splice(routeInsertIndex, 0, routeLine);

  return {
    ok: true,
    content: lines.join("\n"),
    skipped: false,
  };
}

// ── 6. Page generation ──────────────────────────

/**
 * Generate List/Detail/Form page wrapper files for a record.
 * Returns an array of { path, content } objects (relative paths).
 */
export function generatePages(def, defExportName) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);
  const status = def.status;
  const DEF_NAME = defExportName || `${KEY}Def`;

  const listPage = `import { useSession } from "~/hooks/useSession";
import { use${PASCAL}s } from "~/features/${KEY}/hooks/use${PASCAL}";
import { RecordListPage } from "~/pages/records/RecordListPage";
import { ${DEF_NAME} } from "@shared/records/${KEY}";

export function ${PASCAL}ListPage() {
  const { data: session } = useSession();
  const { data = [], isLoading } = use${PASCAL}s(!!session);
  return <RecordListPage def={${DEF_NAME}} data={data} isLoading={isLoading} />;
}
`;

  const statusImport = status
    ? `\nimport { useUpdate${PASCAL}Status } from "~/features/${KEY}/hooks/use${PASCAL}";`
    : "";
  const statusHook = status
    ? `\n  const updateStatus = useUpdate${PASCAL}Status();`
    : "";
  const statusProp = status
    ? `\n      onStatusChange={(s) => updateStatus.mutate({ id, ${camelCase(status.field)}: s })}`
    : "";

  const detailPage = `import { useLocation, useParams } from "wouter";
import { useSession } from "~/hooks/useSession";
import { use${PASCAL}, useDelete${PASCAL} } from "~/features/${KEY}/hooks/use${PASCAL}";${statusImport}
import { RecordDetailPage } from "~/pages/records/RecordDetailPage";
import { ${DEF_NAME} } from "@shared/records/${KEY}";

export function ${PASCAL}DetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const [, navigate] = useLocation();
  const { data: session } = useSession();
  const { data, isLoading } = use${PASCAL}(id, !!session);
  const deleteMutation = useDelete${PASCAL}();${statusHook}

  return (
    <RecordDetailPage
      def={${DEF_NAME}}
      data={data}
      isLoading={isLoading}
      onDelete={() => deleteMutation.mutate(id, { onSuccess: () => navigate("/${KEY}") })}
      isDeleting={deleteMutation.isPending}${statusProp}
    />
  );
}
`;

  const formPage = `import { useLocation, useParams } from "wouter";
import { useSession } from "~/hooks/useSession";
import {
  use${PASCAL},
  useCreate${PASCAL},
  useUpdate${PASCAL},
} from "~/features/${KEY}/hooks/use${PASCAL}";
import { RecordFormPage } from "~/pages/records/RecordFormPage";
import { ${DEF_NAME} } from "@shared/records/${KEY}";

export function ${PASCAL}FormPage({ mode }: { mode: "create" | "edit" }) {
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam ? Number(idParam) : undefined;
  const [, navigate] = useLocation();
  const { data: session } = useSession();
  const { data: existing } = use${PASCAL}(id ?? 0, mode === "edit" && !!session);
  const createMutation = useCreate${PASCAL}();
  const updateMutation = useUpdate${PASCAL}();

  const handleSubmit = (data: Record<string, unknown>) => {
    if (mode === "create") {
      createMutation.mutate(data as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: (row) => navigate(\`/${KEY}/\${row.id}\`),
      });
    } else if (id !== undefined) {
      updateMutation.mutate({ id, ...data } as Parameters<typeof updateMutation.mutate>[0], {
        onSuccess: () => navigate(\`/${KEY}/\${id}\`),
      });
    }
  };

  const mutation = mode === "create" ? createMutation : updateMutation;

  return (
    <RecordFormPage
      def={${DEF_NAME}}
      mode={mode}
      initialData={mode === "edit" ? (existing as Record<string, unknown> | undefined) : undefined}
      onSubmit={handleSubmit}
      isPending={mutation.isPending}
      error={mutation.error?.message ?? null}
    />
  );
}
`;

  return [
    { path: `app/pages/${KEY}/${PASCAL}ListPage.tsx`, content: listPage },
    { path: `app/pages/${KEY}/${PASCAL}DetailPage.tsx`, content: detailPage },
    { path: `app/pages/${KEY}/${PASCAL}FormPage.tsx`, content: formPage },
  ];
}

/**
 * Register a record's page routes and nav item in App.tsx.
 * Returns { ok, content, skipped, reason }.
 */
export function registerAppRoute(existingApp, def) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);

  // Duplicate check — look for actual route registration, not comments
  const routePattern = new RegExp(`<Route[^>]+path=["']/${KEY}(?:/|["'])`);
  if (routePattern.test(existingApp)) {
    return {
      ok: true,
      content: existingApp,
      skipped: true,
      reason: `Route "/${KEY}" already registered in App.tsx`,
    };
  }

  let result = existingApp;

  // 1. Add imports after the last import line
  const importBlock = [
    `import { ${PASCAL}ListPage } from "./pages/${KEY}/${PASCAL}ListPage";`,
    `import { ${PASCAL}DetailPage } from "./pages/${KEY}/${PASCAL}DetailPage";`,
    `import { ${PASCAL}FormPage } from "./pages/${KEY}/${PASCAL}FormPage";`,
  ].join("\n");

  const lines = result.split("\n");
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) {
      lastImportIndex = i;
    }
  }
  if (lastImportIndex !== -1) {
    lines.splice(lastImportIndex + 1, 0, importBlock);
    result = lines.join("\n");
  }

  // 2. Add nav item to recordNavItems array
  const navEntry = `  { label: "${def.label}", href: "/${KEY}" },`;
  result = result.replace(
    /(const recordNavItems.*=\s*\[)([\s\S]*?)(];)/,
    (match, open, body, close) => {
      // Remove example comment line
      const cleaned = body.replace(/\s*\/\/ Example:.*\n/g, "\n");
      return `${open}${cleaned}${navEntry}\n${close}`;
    }
  );

  // 3. Add routes before the {/* record-engine:routes */} marker or before the 404 route
  const routeBlock = [
    `        <Route path="/${KEY}" component={${PASCAL}ListPage} />`,
    `        <Route path="/${KEY}/new">{() => <${PASCAL}FormPage mode="create" />}</Route>`,
    `        <Route path="/${KEY}/:id/edit">{() => <${PASCAL}FormPage mode="edit" />}</Route>`,
    `        <Route path="/${KEY}/:id" component={${PASCAL}DetailPage} />`,
  ].join("\n");

  if (result.includes("{/* record-engine:routes */}")) {
    result = result.replace(
      "{/* record-engine:routes */}",
      `${routeBlock}\n        {/* record-engine:routes */}`
    );
  } else {
    // Fallback: insert before the 404 catch-all route
    result = result.replace(
      /(\s*<Route>\s*\n\s*<div.*404)/,
      `\n${routeBlock}\n$1`
    );
  }

  return {
    ok: true,
    content: result,
    skipped: false,
  };
}

// ── Helpers for hooks/routes generation ─────────

export function fieldToTsType(field) {
  switch (field.type) {
    case "text":
    case "date":
    case "select":
    case "file":
      return "string";
    case "number":
    case "relation":
      return "number";
    default:
      return "string";
  }
}

export function getDefaultSortField(def) {
  const fieldEntries = Object.entries(def.fields);
  const sortField = def.listView?.defaultSort?.field;
  if (sortField && fieldEntries.some(([name]) => name === sortField)) {
    return sortField;
  }
  return "createdAt";
}
