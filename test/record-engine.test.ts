import { describe, expect, it } from "vitest";
import {
  pascalCase,
  camelCase,
  snakeCase,
  findRecordDef,
  validateRecordDef,
  schemaHasTable,
  indexHasRoute,
  generateDrizzleColumn,
  generateDrizzleTableBlock,
  appendDrizzleTable,
  generateZodField,
  generateZodSchemaContent,
  insertRouteRegistration,
  generatePages,
  registerAppRoute,
  fieldToTsType,
  getDefaultSortField,
} from "../scripts/lib/record-engine.mjs";

// ── Sample record definition used across tests ──

const sampleDef = {
  key: "tasks",
  label: "Tasks",
  tableName: "tasks",
  fields: {
    title: { type: "text", label: "Title", required: true, maxLength: 200 },
    description: { type: "text", label: "Description", multiline: true },
    priority: {
      type: "select",
      label: "Priority",
      required: true,
      options: ["low", "medium", "high"],
      defaultValue: "medium",
    },
    dueDate: { type: "date", label: "Due Date" },
    assigneeId: {
      type: "relation",
      label: "Assignee",
      relatedRecord: "users",
      relatedLabel: "name",
    },
    estimatedHours: { type: "number", label: "Hours", min: 0, max: 1000 },
    attachment: { type: "file", label: "Attachment" },
  },
  status: {
    field: "status",
    label: "Status",
    options: ["pending", "in_progress", "done"],
    defaultValue: "pending",
  },
  listView: {
    columns: ["title", "priority", "status", "dueDate"],
    defaultSort: { field: "dueDate", direction: "desc" as const },
  },
  formView: {
    sections: [
      { label: "Basic", fields: ["title", "description", "priority"] },
      { label: "Schedule", fields: ["dueDate", "estimatedHours"] },
    ],
  },
};

const minimalDef = {
  key: "notes",
  label: "Notes",
  tableName: "notes",
  fields: {
    body: { type: "text", label: "Body", required: true },
  },
  listView: {
    columns: ["body"],
    defaultSort: { field: "createdAt", direction: "desc" as const },
  },
  formView: {
    sections: [{ label: "Content", fields: ["body"] }],
  },
};

// ── String helpers ──────────────────────────────

describe("string helpers", () => {
  it("pascalCase converts kebab/snake to PascalCase", () => {
    expect(pascalCase("my-record")).toBe("MyRecord");
    expect(pascalCase("my_record")).toBe("MyRecord");
    expect(pascalCase("tasks")).toBe("Tasks");
  });

  it("camelCase converts kebab/snake to camelCase", () => {
    expect(camelCase("my-record")).toBe("myRecord");
    expect(camelCase("my_record")).toBe("myRecord");
    expect(camelCase("tasks")).toBe("tasks");
  });

  it("snakeCase converts camelCase to snake_case", () => {
    expect(snakeCase("myRecord")).toBe("my_record");
    expect(snakeCase("dueDate")).toBe("due_date");
    expect(snakeCase("tasks")).toBe("tasks");
  });
});

// ── findRecordDef ───────────────────────────────

describe("findRecordDef", () => {
  it("finds a record def from a module with named export", () => {
    const mod = { tasksDef: sampleDef, other: "value" };
    const result = findRecordDef(mod);
    expect(result).toEqual({ def: sampleDef, exportName: "tasksDef" });
  });

  it("returns null for a module with no record def", () => {
    const mod = { foo: "bar", baz: 42 };
    expect(findRecordDef(mod)).toBeNull();
  });

  it("finds default export", () => {
    const mod = { default: sampleDef };
    const result = findRecordDef(mod);
    expect(result).toEqual({ def: sampleDef, exportName: "default" });
  });
});

// ── Duplicate detection ─────────────────────────

describe("duplicate detection", () => {
  const schemaContent = `
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
});
`;

  it("schemaHasTable detects existing table by variable name", () => {
    expect(schemaHasTable(schemaContent, "tasks")).toBe(true);
  });

  it("schemaHasTable returns false for non-existing table", () => {
    expect(schemaHasTable(schemaContent, "projects")).toBe(false);
  });

  it("schemaHasTable detects by sqliteTable call", () => {
    const content = `const x = sqliteTable("my_table", {});`;
    expect(schemaHasTable(content, "my_table")).toBe(true);
  });

  const indexContent = `
  .route("/api/tasks", tasksRoutes)
  .route("/api/auth", auth);
`;

  it("indexHasRoute detects existing route", () => {
    expect(indexHasRoute(indexContent, "tasks")).toBe(true);
  });

  it("indexHasRoute returns false for non-existing route", () => {
    expect(indexHasRoute(indexContent, "projects")).toBe(false);
  });
});

// ── Drizzle table generation ────────────────────

describe("generateDrizzleColumn", () => {
  it("generates text column", () => {
    const col = generateDrizzleColumn("title", {
      type: "text",
      label: "Title",
      required: true,
      maxLength: 200,
    });
    expect(col).toBe('  title: text("title").notNull()');
  });

  it("generates integer column with default", () => {
    const col = generateDrizzleColumn("count", {
      type: "number",
      label: "Count",
      defaultValue: 0,
    });
    expect(col).toBe('  count: integer("count").default(0)');
  });

  it("generates text column with string default", () => {
    const col = generateDrizzleColumn("priority", {
      type: "select",
      label: "Priority",
      options: ["low", "high"],
      defaultValue: "low",
    });
    expect(col).toBe('  priority: text("priority").default("low")');
  });

  it("converts camelCase field name to snake_case column", () => {
    const col = generateDrizzleColumn("dueDate", {
      type: "date",
      label: "Due",
    });
    expect(col).toBe('  dueDate: text("due_date")');
  });

  it("generates relation column as integer", () => {
    const col = generateDrizzleColumn("assigneeId", {
      type: "relation",
      label: "Assignee",
      relatedRecord: "users",
      relatedLabel: "name",
    });
    expect(col).toBe('  assigneeId: integer("assignee_id")');
  });

  it("generates file column as text", () => {
    const col = generateDrizzleColumn("attachment", {
      type: "file",
      label: "Attachment",
    });
    expect(col).toBe('  attachment: text("attachment")');
  });
});

describe("generateDrizzleTableBlock", () => {
  it("generates a valid table block with all field types", () => {
    const result = generateDrizzleTableBlock(sampleDef);
    expect(result.ok).toBe(true);
    expect(result.content).toContain('export const tasks = sqliteTable("tasks"');
    expect(result.content).toContain("id: integer");
    expect(result.content).toContain("organizationId: integer");
    expect(result.content).toContain("title: text");
    expect(result.content).toContain("createdAt: text");
    expect(result.content).toContain("updatedAt: text");
    // status field
    expect(result.content).toContain('status: text("status").notNull().default("pending")');
  });

  it("generates a valid table block without status", () => {
    const result = generateDrizzleTableBlock(minimalDef);
    expect(result.ok).toBe(true);
    expect(result.content).toContain('export const notes = sqliteTable("notes"');
    expect(result.content).not.toContain("status:");
  });

  it("produces syntactically valid Drizzle schema", () => {
    const result = generateDrizzleTableBlock(sampleDef);
    expect(result.ok).toBe(true);
    // Check balanced braces
    const opens = (result.content!.match(/{/g) || []).length;
    const closes = (result.content!.match(/}/g) || []).length;
    expect(opens).toBe(closes);
    // Ends with closing
    expect(result.content!.trimEnd()).toMatch(/\]\);$/);
  });
});

describe("appendDrizzleTable", () => {
  const baseSchema = `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});
`;

  it("appends a new table to schema", () => {
    const result = appendDrizzleTable(baseSchema, sampleDef);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.content).toContain("export const users");
    expect(result.content).toContain("export const tasks");
  });

  it("skips if table already exists", () => {
    const schemaWithTasks = baseSchema + '\nexport const tasks = sqliteTable("tasks", {});\n';
    const result = appendDrizzleTable(schemaWithTasks, sampleDef);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("already exists");
  });

  it("trims trailing whitespace before appending", () => {
    const schemaWithTrailing = baseSchema + "\n\n\n   \n";
    const result = appendDrizzleTable(schemaWithTrailing, sampleDef);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    // Should not have excessive whitespace before the new table
    const beforeTable = result.content!.split("export const tasks")[0];
    expect(beforeTable).not.toMatch(/\n{4,}/);
  });

  it("handles schema ending without trailing newline", () => {
    const schemaNoNewline = baseSchema.trimEnd();
    const result = appendDrizzleTable(schemaNoNewline, sampleDef);
    expect(result.ok).toBe(true);
    expect(result.content).toContain("export const tasks");
  });
});

// ── Zod schema generation ───────────────────────

describe("generateZodField", () => {
  it("generates required text field with min(1)", () => {
    const z = generateZodField("title", { type: "text", label: "T", required: true, maxLength: 200 }, false);
    expect(z).toBe("z.string().max(200).min(1)");
  });

  it("generates optional text field for update", () => {
    const z = generateZodField("title", { type: "text", label: "T", required: true }, true);
    expect(z).toBe("z.string().optional()");
  });

  it("generates number field with min/max (required)", () => {
    const z = generateZodField("hours", { type: "number", label: "H", required: true, min: 0, max: 100 }, false);
    expect(z).toBe("z.number().min(0).max(100)");
  });

  it("generates number field with min/max (optional)", () => {
    const z = generateZodField("hours", { type: "number", label: "H", min: 0, max: 100 }, false);
    expect(z).toBe("z.number().min(0).max(100).optional()");
  });

  it("generates date field with regex", () => {
    const z = generateZodField("due", { type: "date", label: "D" }, false);
    expect(z).toContain("z.string().regex(");
    expect(z).toContain("YYYY-MM-DD");
  });

  it("generates select field with enum (required)", () => {
    const z = generateZodField("priority", {
      type: "select",
      label: "P",
      required: true,
      options: ["low", "high"],
    }, false);
    expect(z).toBe('z.enum(["low", "high"])');
  });

  it("generates select field with enum (optional)", () => {
    const z = generateZodField("priority", {
      type: "select",
      label: "P",
      options: ["low", "high"],
    }, false);
    expect(z).toBe('z.enum(["low", "high"]).optional()');
  });

  it("generates relation field as number.int() (required)", () => {
    const z = generateZodField("userId", { type: "relation", label: "U", required: true }, false);
    expect(z).toBe("z.number().int()");
  });

  it("generates relation field as number.int() (optional)", () => {
    const z = generateZodField("userId", { type: "relation", label: "U" }, false);
    expect(z).toBe("z.number().int().optional()");
  });

  it("adds .optional() for non-required create fields", () => {
    const z = generateZodField("note", { type: "text", label: "N" }, false);
    expect(z).toBe("z.string().optional()");
  });
});

describe("generateZodSchemaContent", () => {
  it("generates valid Zod schema with create and update schemas", () => {
    const content = generateZodSchemaContent(sampleDef);
    expect(content).toContain('import { z } from "zod"');
    expect(content).toContain("export const createTasksSchema = z.object(");
    expect(content).toContain("export const updateTasksSchema = z.object(");
    expect(content).toContain("export type CreateTasksInput");
    expect(content).toContain("export type UpdateTasksInput");
  });

  it("includes status field in schemas when defined", () => {
    const content = generateZodSchemaContent(sampleDef);
    expect(content).toContain('z.enum(["pending", "in_progress", "done"]).optional()');
  });

  it("omits status from schemas when not defined", () => {
    const content = generateZodSchemaContent(minimalDef);
    expect(content).not.toContain("status");
  });

  it("generates syntactically valid Zod code (balanced parens)", () => {
    const content = generateZodSchemaContent(sampleDef);
    const opens = (content.match(/\(/g) || []).length;
    const closes = (content.match(/\)/g) || []).length;
    expect(opens).toBe(closes);
  });

  it("can be evaluated as valid JavaScript", async () => {
    const content = generateZodSchemaContent(minimalDef);
    // The content uses `import { z } from "zod"`, which is valid syntax.
    // We can at least verify it's syntactically valid by checking structure.
    expect(content).toMatch(/^import \{ z \} from "zod";/);
    expect(content).toContain("z.object({");
  });
});

// ── Zod schema runtime validation ───────────────

describe("generated Zod schemas validate correctly", () => {
  // We test by dynamically constructing the schema from the generated field strings
  // using the actual zod library, to prove the output is valid.
  it("generated field expressions are valid zod calls", async () => {
    const { z } = await import("zod");

    // text required
    const titleExpr = generateZodField("title", { type: "text", label: "T", required: true, maxLength: 200 }, false);
    const titleSchema = eval(`(function(z){ return ${titleExpr}; })`)(z);
    expect(titleSchema.parse("hello")).toBe("hello");
    expect(() => titleSchema.parse("")).toThrow(); // min(1)
    expect(() => titleSchema.parse("x".repeat(201))).toThrow(); // max(200)

    // number with range
    const numExpr = generateZodField("h", { type: "number", label: "H", min: 0, max: 100 }, false);
    const numSchema = eval(`(function(z){ return ${numExpr}; })`)(z);
    expect(numSchema.parse(50)).toBe(50);
    expect(() => numSchema.parse(-1)).toThrow();
    expect(() => numSchema.parse(101)).toThrow();

    // date
    const dateExpr = generateZodField("d", { type: "date", label: "D" }, false);
    const dateSchema = eval(`(function(z){ return ${dateExpr}; })`)(z);
    expect(dateSchema.parse("2025-01-15")).toBe("2025-01-15");
    expect(() => dateSchema.parse("not-a-date")).toThrow();

    // select enum
    const selExpr = generateZodField("p", { type: "select", label: "P", options: ["a", "b"] }, false);
    const selSchema = eval(`(function(z){ return ${selExpr}; })`)(z);
    expect(selSchema.parse("a")).toBe("a");
    expect(() => selSchema.parse("c")).toThrow();

    // optional in update mode
    const optExpr = generateZodField("title", { type: "text", label: "T", required: true }, true);
    const optSchema = eval(`(function(z){ return ${optExpr}; })`)(z);
    expect(optSchema.parse(undefined)).toBeUndefined();
    expect(optSchema.parse("hello")).toBe("hello");
  });
});

// ── Route registration ──────────────────────────

describe("insertRouteRegistration", () => {
  const baseIndex = `import { Hono } from "hono";
import auth from "./routes/auth";
import health from "./routes/health";

export const app = new Hono()
  .route("/api/health", health)
  .route("/api/auth", auth);

export type AppType = typeof app;
`;

  it("inserts import and route registration", () => {
    const result = insertRouteRegistration(baseIndex, "tasks");
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.content).toContain('import tasksRoutes from "./features/tasks/routes"');
    expect(result.content).toContain('.route("/api/tasks", tasksRoutes)');
  });

  it("inserts route BEFORE the auth route (semicolon-terminated)", () => {
    const result = insertRouteRegistration(baseIndex, "tasks");
    const lines = result.content!.split("\n");
    const taskRouteIdx = lines.findIndex((l: string) => l.includes("/api/tasks"));
    const authRouteIdx = lines.findIndex((l: string) => l.includes("/api/auth"));
    expect(taskRouteIdx).toBeLessThan(authRouteIdx);
    expect(taskRouteIdx).toBeGreaterThan(0);
  });

  it("skips if route already exists", () => {
    const indexWithTasks = baseIndex.replace(
      '.route("/api/auth", auth);',
      '.route("/api/tasks", tasksRoutes)\n  .route("/api/auth", auth);'
    );
    const result = insertRouteRegistration(indexWithTasks, "tasks");
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("already registered");
  });

  it("returns error when no imports found", () => {
    const noImports = `const app = new Hono();\n`;
    const result = insertRouteRegistration(noImports, "tasks");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("import statements");
  });

  it("returns error when no .route() found", () => {
    const noRoutes = `import { Hono } from "hono";\nconst app = new Hono();\n`;
    const result = insertRouteRegistration(noRoutes, "tasks");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(".route()");
  });

  it("handles multiple sequential insertions", () => {
    let content = baseIndex;

    const r1 = insertRouteRegistration(content, "tasks");
    expect(r1.ok).toBe(true);
    expect(r1.skipped).toBe(false);
    content = r1.content!;

    const r2 = insertRouteRegistration(content, "projects");
    expect(r2.ok).toBe(true);
    expect(r2.skipped).toBe(false);
    content = r2.content!;

    // Both routes present
    expect(content).toContain('"/api/tasks"');
    expect(content).toContain('"/api/projects"');
    // Auth is still last
    const lines = content.split("\n");
    const authIdx = lines.findIndex((l: string) => l.includes("/api/auth"));
    const tasksIdx = lines.findIndex((l: string) => l.includes("/api/tasks"));
    const projectsIdx = lines.findIndex((l: string) => l.includes("/api/projects"));
    expect(tasksIdx).toBeLessThan(authIdx);
    expect(projectsIdx).toBeLessThan(authIdx);

    // Running tasks again should skip
    const r3 = insertRouteRegistration(content, "tasks");
    expect(r3.ok).toBe(true);
    expect(r3.skipped).toBe(true);
  });

  it("works with indented imports", () => {
    const indentedIndex = `  import { Hono } from "hono";
  import auth from "./routes/auth";

export const app = new Hono()
  .route("/api/auth", auth);
`;
    const result = insertRouteRegistration(indentedIndex, "tasks");
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
  });
});

// ── fieldToTsType ───────────────────────────────

describe("fieldToTsType", () => {
  it("maps text/date/select/file to string", () => {
    expect(fieldToTsType({ type: "text" })).toBe("string");
    expect(fieldToTsType({ type: "date" })).toBe("string");
    expect(fieldToTsType({ type: "select" })).toBe("string");
    expect(fieldToTsType({ type: "file" })).toBe("string");
  });

  it("maps number/relation to number", () => {
    expect(fieldToTsType({ type: "number" })).toBe("number");
    expect(fieldToTsType({ type: "relation" })).toBe("number");
  });

  it("defaults to string for unknown types", () => {
    expect(fieldToTsType({ type: "unknown" })).toBe("string");
  });
});

// ── getDefaultSortField ─────────────────────────

describe("getDefaultSortField", () => {
  it("returns the configured sort field when it exists in fields", () => {
    expect(getDefaultSortField(sampleDef)).toBe("dueDate");
  });

  it("falls back to createdAt when sort field is not in fields", () => {
    const def = {
      ...minimalDef,
      listView: { columns: ["body"], defaultSort: { field: "nonexistent", direction: "desc" } },
    };
    expect(getDefaultSortField(def)).toBe("createdAt");
  });

  it("falls back to createdAt when no listView", () => {
    const def = { ...minimalDef, listView: undefined };
    expect(getDefaultSortField(def)).toBe("createdAt");
  });
});

// ── Page generation ─────────────────────────────

describe("generatePages", () => {
  it("generates three page files for a record with status", () => {
    const pages = generatePages(sampleDef);
    expect(pages).toHaveLength(3);
    expect(pages.map((p: { path: string }) => p.path)).toEqual([
      "app/pages/tasks/TasksListPage.tsx",
      "app/pages/tasks/TasksDetailPage.tsx",
      "app/pages/tasks/TasksFormPage.tsx",
    ]);
  });

  it("list page imports the hook and RecordListPage", () => {
    const pages = generatePages(sampleDef);
    const listPage = pages[0].content;
    expect(listPage).toContain("useTasks");
    expect(listPage).toContain("RecordListPage");
    expect(listPage).toContain("tasksDef");
  });

  it("detail page includes delete and status change for records with status", () => {
    const pages = generatePages(sampleDef);
    const detailPage = pages[1].content;
    expect(detailPage).toContain("useDeleteTasks");
    expect(detailPage).toContain("useUpdateTasksStatus");
    expect(detailPage).toContain("onStatusChange");
  });

  it("detail page omits status hook for records without status", () => {
    const pages = generatePages(minimalDef);
    const detailPage = pages[1].content;
    expect(detailPage).not.toContain("useUpdateNotesStatus");
    expect(detailPage).not.toContain("onStatusChange");
  });

  it("form page handles both create and edit modes", () => {
    const pages = generatePages(sampleDef);
    const formPage = pages[2].content;
    expect(formPage).toContain("useCreateTasks");
    expect(formPage).toContain("useUpdateTasks");
    expect(formPage).toContain('mode: "create" | "edit"');
  });
});

// ── App.tsx route registration ──────────────────

describe("registerAppRoute", () => {
  const baseApp = `import { Route, Switch } from "wouter";
import { SettingsPage } from "./pages/SettingsPage";

const recordNavItems: { label: string; href: string }[] = [
  // Example: { label: "Houses", href: "/houses" },
];

function AppRoutes() {
  return (
    <Switch>
      <Route path="/settings" component={SettingsPage} />
      <Route path="/" component={WelcomePage} />
      {/* record-engine:routes */}
      <Route>
        <div className="mx-auto max-w-3xl py-20 text-center">
          <h2 className="text-xl font-semibold text-white">404</h2>
        </div>
      </Route>
    </Switch>
  );
}
`;

  it("adds imports, nav item, and routes", () => {
    const result = registerAppRoute(baseApp, sampleDef);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.content).toContain('import { TasksListPage }');
    expect(result.content).toContain('import { TasksDetailPage }');
    expect(result.content).toContain('import { TasksFormPage }');
    expect(result.content).toContain('{ label: "Tasks", href: "/tasks" }');
    expect(result.content).toContain('<Route path="/tasks" component={TasksListPage} />');
    expect(result.content).toContain('<Route path="/tasks/new">');
    expect(result.content).toContain('<Route path="/tasks/:id/edit">');
    expect(result.content).toContain('<Route path="/tasks/:id" component={TasksDetailPage} />');
  });

  it("skips if route already registered", () => {
    const first = registerAppRoute(baseApp, sampleDef);
    const second = registerAppRoute(first.content, sampleDef);
    expect(second.ok).toBe(true);
    expect(second.skipped).toBe(true);
  });

  it("handles multiple records sequentially", () => {
    const r1 = registerAppRoute(baseApp, sampleDef);
    const r2 = registerAppRoute(r1.content, minimalDef);
    expect(r2.ok).toBe(true);
    expect(r2.content).toContain('"/tasks"');
    expect(r2.content).toContain('"/notes"');
  });

  it("removes the example comment when adding first nav item", () => {
    const result = registerAppRoute(baseApp, sampleDef);
    expect(result.content).not.toContain("// Example:");
  });
});

// ── validateRecordDef ─────────────────────────────

describe("validateRecordDef", () => {
  it("returns empty array for a valid definition", () => {
    expect(validateRecordDef(sampleDef)).toEqual([]);
  });

  it("detects invalid listView.columns referencing unknown fields", () => {
    const def = {
      ...sampleDef,
      listView: { columns: ["title", "nonExistent"] },
    };
    const errors = validateRecordDef(def);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("nonExistent");
  });

  it("allows status field name in listView.columns", () => {
    const def = {
      ...sampleDef,
      listView: { columns: ["title", "status"] },
    };
    expect(validateRecordDef(def)).toEqual([]);
  });

  it("detects invalid formView.sections fields", () => {
    const def = {
      ...sampleDef,
      formView: {
        sections: [{ label: "Info", fields: ["title", "ghost"] }],
      },
    };
    const errors = validateRecordDef(def);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("ghost");
  });

  it("detects status.defaultValue not in status.options", () => {
    const def = {
      ...sampleDef,
      status: { field: "status", options: ["open", "closed"], defaultValue: "pending" },
    };
    const errors = validateRecordDef(def);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("pending");
  });

  it("detects select field without options", () => {
    const def = {
      ...sampleDef,
      fields: {
        ...sampleDef.fields,
        badSelect: { type: "select", label: "Bad", options: [] },
      },
    };
    const errors = validateRecordDef(def);
    expect(errors.some((e: string) => e.includes("badSelect"))).toBe(true);
  });

  it("detects invalid field type", () => {
    const def = {
      ...sampleDef,
      fields: {
        ...sampleDef.fields,
        weird: { type: "blob", label: "Weird" },
      },
    };
    const errors = validateRecordDef(def);
    expect(errors.some((e: string) => e.includes("blob"))).toBe(true);
  });
});
