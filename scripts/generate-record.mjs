#!/usr/bin/env node
/**
 * Record Engine — Code Generator
 *
 * Usage:
 *   node scripts/generate-record.mjs --record shared/records/requests.ts
 *
 * Generates:
 *   1. Drizzle table definition → appended to src/db/schema.ts
 *   2. Zod schemas → shared/features/{key}/schema.ts
 *   3. Hono routes → src/features/{key}/routes.ts
 *   4. TanStack Query hooks → app/features/{key}/hooks/use{Key}.ts
 *   5. Route registration → appended to src/index.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import {
  findRecordDef,
  resolveDefExportName,
  validateRecordDef,
  pascalCase,
  camelCase,
  snakeCase,
  appendDrizzleTable,
  generateZodSchemaContent,
  insertRouteRegistration,
  generatePages,
  registerAppRoute,
  fieldToTsType,
  getDefaultSortField,
  schemaHasTable,
  indexHasRoute,
} from "./lib/record-engine.mjs";

// ── CLI args ───────────────────────────────────
const { values } = parseArgs({
  options: {
    record: { type: "string" },
  },
});

if (!values.record) {
  console.error("Usage: node scripts/generate-record.mjs --record <path>");
  process.exit(1);
}

// ── Load record definition ─────────────────────
const recordPath = resolve(process.cwd(), values.record);
if (!existsSync(recordPath)) {
  console.error(`Record file not found: ${recordPath}`);
  process.exit(1);
}

const { build } = await import("esbuild");
const tmpOut = resolve(process.cwd(), "node_modules/.cache/record-gen-tmp.mjs");
mkdirSync(dirname(tmpOut), { recursive: true });

await build({
  entryPoints: [recordPath],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: tmpOut,
  write: true,
  logLevel: "silent",
});

// Dynamic import of the transpiled file
const mod = await import(`file://${tmpOut}`);
const found = findRecordDef(mod);

if (!found) {
  console.error("No record definition found in the exported module.");
  console.error(
    "Make sure you export the result of defineRecord() as a named or default export."
  );
  process.exit(1);
}

const { def, exportName } = found;

// Validate record definition integrity
const validationErrors = validateRecordDef(def);
if (validationErrors.length > 0) {
  console.error("Record definition validation failed:");
  for (const err of validationErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

const { name: defExportName, warning: namingWarning } = resolveDefExportName(def.key, exportName);
if (namingWarning) {
  console.warn(`  [warn] ${namingWarning}`);
}

console.log(`\nRecord Engine: generating "${def.key}" (${def.label})\n`);

// ── Helpers ────────────────────────────────────
function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

const KEY = def.key;
const PASCAL = pascalCase(KEY);
const TABLE = def.tableName;
const fields = def.fields;
const status = def.status;
const fieldEntries = Object.entries(fields);

// ── 1. Drizzle table definition ────────────────
function generateDrizzleTable() {
  const schemaPath = resolve(process.cwd(), "src/db/schema.ts");
  const existing = readFileSync(schemaPath, "utf-8");

  const result = appendDrizzleTable(existing, def);
  if (!result.ok) {
    console.error(`  [error] ${result.reason}`);
    process.exit(1);
  }
  if (result.skipped) {
    console.log(`  [skip] ${result.reason}`);
    return;
  }

  writeFileSync(schemaPath, result.content);
  console.log(`  [gen] src/db/schema.ts — added table "${TABLE}"`);
}

// ── 2. Zod schemas ─────────────────────────────
function generateZodSchemas() {
  const outPath = resolve(
    process.cwd(),
    `shared/features/${KEY}/schema.ts`
  );
  ensureDir(outPath);

  if (existsSync(outPath)) {
    console.log(`  [skip] Zod schema already exists: shared/features/${KEY}/schema.ts`);
    return;
  }

  const content = generateZodSchemaContent(def);
  writeFileSync(outPath, content);
  console.log(`  [gen] shared/features/${KEY}/schema.ts`);
}

// ── 3. Hono routes ─────────────────────────────
function generateRoutes() {
  const outPath = resolve(
    process.cwd(),
    `src/features/${KEY}/routes.ts`
  );
  ensureDir(outPath);

  if (existsSync(outPath)) {
    console.log(`  [skip] Routes already exist: src/features/${KEY}/routes.ts`);
    return;
  }

  const tableVar = camelCase(TABLE);
  const schemaImportPath = `../../../shared/features/${KEY}/schema`;

  // Build the set object for update
  const updateSetFields = fieldEntries
    .map(([name]) => `          ...(${name} !== undefined ? { ${name} } : {})`)
    .join(",\n");
  const updateDestructure = fieldEntries.map(([name]) => name).join(", ");

  // Status set field
  const statusSetField = status
    ? `,\n          ...(${camelCase(status.field)} !== undefined ? { ${camelCase(status.field)} } : {})`
    : "";
  const statusDestructure = status ? `, ${camelCase(status.field)}` : "";

  // Status change endpoint
  const statusRoute = status ? generateStatusRoute(tableVar) : "";

  const zodImport = status ? `\nimport { z } from "zod";` : "";

  const sortField = getDefaultSortField(def);
  const sd = def.softDelete;

  // Drizzle imports: add isNull when softDelete is enabled
  const drizzleImports = sd
    ? `and, desc, eq, isNull`
    : `and, desc, eq`;

  // WHERE helpers for soft delete
  const listWhere = sd
    ? `and(eq(${tableVar}.organizationId, orgId), isNull(${tableVar}.deletedAt))`
    : `eq(${tableVar}.organizationId, orgId)`;
  const oneWhere = sd
    ? `and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId), isNull(${tableVar}.deletedAt))`
    : `and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId))`;

  // DELETE body: soft delete sets deletedAt, hard delete removes the row
  const deleteBody = sd
    ? `const [row] = await db
      .update(${tableVar})
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
      .returning();`
    : `const [row] = await db
      .delete(${tableVar})
      .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
      .returning();`;

  const content = `import { Hono } from "hono";
import { ${drizzleImports} } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";${zodImport}
import { ${tableVar} } from "../../db/schema";
import {
  create${PASCAL}Schema,
  update${PASCAL}Schema,
} from "${schemaImportPath}";
import { requireAuth } from "../../middleware/auth";
import type { AppContextEnv } from "../../types";
import { writeAuditLog } from "../../lib/audit";
import { jsonError } from "../../lib/http";
import { validator } from "../../lib/validator";

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  // LIST
  .get("/", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(c, 403, "org_context_required", "Current organization is required");
    }
    const db = drizzle(c.env.DB);
    const rows = await db
      .select()
      .from(${tableVar})
      .where(${listWhere})
      .orderBy(desc(${tableVar}.${sortField}));
    return c.json(rows);
  })
  // CREATE
  .post(
    "/",
    validator("json", create${PASCAL}Schema),
    async (c) => {
      const orgId = c.get("orgId");
      if (!orgId) {
        return jsonError(c, 403, "org_context_required", "Current organization is required");
      }
      const db = drizzle(c.env.DB);
      const body = c.req.valid("json");
      const [row] = await db
        .insert(${tableVar})
        .values({ organizationId: orgId, ...body })
        .returning();
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "${KEY}.create",
        resourceType: "${KEY}",
        resourceId: String(row.id),
        status: 201,
        metadata: body,
      });
      return c.json(row, 201);
    }
  )
  // GET ONE
  .get("/:id", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(c, 403, "org_context_required", "Current organization is required");
    }
    const db = drizzle(c.env.DB);
    const id = Number(c.req.param("id"));
    const [row] = await db
      .select()
      .from(${tableVar})
      .where(${oneWhere});
    if (!row) {
      return jsonError(c, 404, "not_found", "${PASCAL} not found");
    }
    return c.json(row);
  })
  // UPDATE
  .put(
    "/:id",
    validator("json", update${PASCAL}Schema),
    async (c) => {
      const orgId = c.get("orgId");
      if (!orgId) {
        return jsonError(c, 403, "org_context_required", "Current organization is required");
      }
      const db = drizzle(c.env.DB);
      const id = Number(c.req.param("id"));
      const { ${updateDestructure}${statusDestructure} } = c.req.valid("json");
      const [row] = await db
        .update(${tableVar})
        .set({
${updateSetFields}${statusSetField},
          updatedAt: new Date().toISOString(),
        })
        .where(${oneWhere})
        .returning();
      if (!row) {
        return jsonError(c, 404, "not_found", "${PASCAL} not found");
      }
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "${KEY}.update",
        resourceType: "${KEY}",
        resourceId: String(row.id),
        status: 200,
        metadata: { ${updateDestructure}${statusDestructure} },
      });
      return c.json(row);
    }
  )
  // DELETE${sd ? " (soft)" : ""}
  .delete("/:id", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(c, 403, "org_context_required", "Current organization is required");
    }
    const db = drizzle(c.env.DB);
    const id = Number(c.req.param("id"));
    ${deleteBody}
    if (!row) {
      return jsonError(c, 404, "not_found", "${PASCAL} not found");
    }
    await writeAuditLog(c.env.DB, c, {
      actorUserId: c.get("userId") ?? null,
      organizationId: orgId,
      action: "${KEY}.delete",
      resourceType: "${KEY}",
      resourceId: String(row.id),
      status: 200,
    });
    return c.json({ ok: true });
  })${statusRoute};

export default app;
`;

  writeFileSync(outPath, content);
  console.log(`  [gen] src/features/${KEY}/routes.ts`);
}

function generateStatusRoute(tableVar) {
  const statusField = camelCase(status.field);
  const opts = status.options.map((o) => `"${o}"`).join(", ");

  return `
  // STATUS CHANGE
  .patch(
    "/:id/status",
    validator("json", z.object({ ${statusField}: z.enum([${opts}]) })),
    async (c) => {
      const orgId = c.get("orgId");
      if (!orgId) {
        return jsonError(c, 403, "org_context_required", "Current organization is required");
      }
      const db = drizzle(c.env.DB);
      const id = Number(c.req.param("id"));
      const { ${statusField} } = c.req.valid("json");

      // Get current status for audit
      const [current] = await db
        .select({ ${statusField}: ${tableVar}.${statusField} })
        .from(${tableVar})
        .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)));
      if (!current) {
        return jsonError(c, 404, "not_found", "${PASCAL} not found");
      }

      const [row] = await db
        .update(${tableVar})
        .set({ ${statusField}, updatedAt: new Date().toISOString() })
        .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
        .returning();

      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "${KEY}.status_change",
        resourceType: "${KEY}",
        resourceId: String(row.id),
        status: 200,
        metadata: { from: current.${statusField}, to: ${statusField} },
      });
      return c.json(row);
    }
  )`;
}

// ── 4. TanStack Query hooks ────────────────────
function generateHooks() {
  const outPath = resolve(
    process.cwd(),
    `app/features/${KEY}/hooks/use${PASCAL}.ts`
  );
  ensureDir(outPath);

  if (existsSync(outPath)) {
    console.log(`  [skip] Hooks already exist: app/features/${KEY}/hooks/use${PASCAL}.ts`);
    return;
  }

  const queryKey = `${KEY.toUpperCase()}_KEY`;

  // Build the record type from fields
  const typeFields = [];
  typeFields.push("  id: number;");
  typeFields.push("  organizationId: number;");
  for (const [name, field] of fieldEntries) {
    const tsType = fieldToTsType(field);
    const optional = field.required ? "" : " | null";
    typeFields.push(`  ${name}: ${tsType}${optional};`);
  }
  if (status) {
    typeFields.push(`  ${camelCase(status.field)}: string;`);
  }
  typeFields.push("  createdAt: string;");
  typeFields.push("  updatedAt: string;");

  // Create input type
  const createFields = [];
  for (const [name, field] of fieldEntries) {
    const tsType = fieldToTsType(field);
    const optional = field.required ? "" : "?";
    createFields.push(`  ${name}${optional}: ${tsType};`);
  }
  if (status) {
    createFields.push(`  ${camelCase(status.field)}?: string;`);
  }

  const statusHook = status ? generateStatusHook(queryKey) : "";

  const content = `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "~/lib/api";
import { readApiError } from "~/lib/errors";
import type { Create${PASCAL}Input, Update${PASCAL}Input } from "@shared/features/${KEY}/schema";

const ${queryKey} = ["${KEY}"] as const;

export type ${PASCAL}Record = {
${typeFields.join("\n")}
};

export function use${PASCAL}s(enabled: boolean) {
  return useQuery({
    queryKey: ${queryKey},
    enabled,
    queryFn: async () => {
      const res = await client.api.${KEY}.$get();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch ${KEY}"));
      return (await res.json()) as ${PASCAL}Record[];
    },
  });
}

export function use${PASCAL}(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...${queryKey}, id],
    enabled,
    queryFn: async () => {
      const res = await client.api.${KEY}[":id"].$get({
        param: { id: String(id) },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch ${KEY}"));
      return (await res.json()) as ${PASCAL}Record;
    },
  });
}

export function useCreate${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Create${PASCAL}Input) => {
      const res = await client.api.${KEY}.$post({ json: input });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create ${KEY}"));
      return (await res.json()) as ${PASCAL}Record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}

export function useUpdate${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Update${PASCAL}Input & { id: number }) => {
      const res = await client.api.${KEY}[":id"].$put({
        param: { id: String(id) },
        json: input,
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update ${KEY}"));
      return (await res.json()) as ${PASCAL}Record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}

export function useDelete${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await client.api.${KEY}[":id"].$delete({
        param: { id: String(id) },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to delete ${KEY}"));
      return (await res.json()) as { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}
${statusHook}`;

  writeFileSync(outPath, content);
  console.log(`  [gen] app/features/${KEY}/hooks/use${PASCAL}.ts`);
}

function generateStatusHook(queryKey) {
  const statusField = camelCase(status.field);
  return `
export function useUpdate${PASCAL}Status() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ${statusField} }: { id: number; ${statusField}: string }) => {
      const res = await client.api.${KEY}[":id"]["status"].$patch({
        param: { id: String(id) },
        json: { ${statusField} },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update status"));
      return (await res.json()) as ${PASCAL}Record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}
`;
}

// ── 5. Route registration in src/index.ts ──────
function registerRoute() {
  const indexPath = resolve(process.cwd(), "src/index.ts");
  const existing = readFileSync(indexPath, "utf-8");

  const result = insertRouteRegistration(existing, KEY);
  if (!result.ok) {
    console.error(`  [error] ${result.reason}`);
    process.exit(1);
  }
  if (result.skipped) {
    console.log(`  [skip] ${result.reason}`);
    return;
  }

  writeFileSync(indexPath, result.content);
  console.log(`  [gen] src/index.ts — registered route "/api/${KEY}"`);
}

// ── 6. Page wrappers ─────────────────────────
function generatePageWrappers() {
  const pages = generatePages(def, defExportName);
  for (const page of pages) {
    const outPath = resolve(process.cwd(), page.path);
    ensureDir(outPath);
    if (existsSync(outPath)) {
      console.log(`  [skip] Page already exists: ${page.path}`);
      continue;
    }
    writeFileSync(outPath, page.content);
    console.log(`  [gen] ${page.path}`);
  }
}

// ── 7. App.tsx route registration ────────────
function registerAppRoutes() {
  const appPath = resolve(process.cwd(), "app/App.tsx");
  if (!existsSync(appPath)) {
    console.log(`  [skip] app/App.tsx not found — skipping route registration`);
    return;
  }
  const existing = readFileSync(appPath, "utf-8");
  const result = registerAppRoute(existing, def);
  if (!result.ok) {
    console.error(`  [error] ${result.reason}`);
    return;
  }
  if (result.skipped) {
    console.log(`  [skip] ${result.reason}`);
    return;
  }
  writeFileSync(appPath, result.content);
  console.log(`  [gen] app/App.tsx — registered routes and nav for "${KEY}"`);
}

// ── Run all generators ─────────────────────────
generateDrizzleTable();
generateZodSchemas();
generateRoutes();
generateHooks();
registerRoute();
generatePageWrappers();
registerAppRoutes();

console.log(`\nDone! Next steps:`);
console.log(`  1. npm run db:generate    # Generate migration`);
console.log(`  2. npm run db:migrate     # Apply migration`);
console.log(`  3. npm run dev            # Start dev server`);
console.log("");
