import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ── Grant tables ────────────────────────────────

export const grants = sqliteTable(
  "grants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    sourceMinistry: text("source_ministry").notNull(),
    sourceUrl: text("source_url").notNull().unique(),
    publishedAt: text("published_at"),
    deadline: text("deadline"),
    rawText: text("raw_text"),
    categoryRaw: text("category_raw"),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
  },
  (table) => [
    index("idx_grants_source_ministry").on(table.sourceMinistry),
    index("idx_grants_deadline").on(table.deadline),
  ]
);

export const grantAiAnalyses = sqliteTable(
  "grant_ai_analyses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    grantId: integer("grant_id")
      .notNull()
      .unique()
      .references(() => grants.id, { onDelete: "cascade" }),
    summaryShort: text("summary_short"),
    supportType: text("support_type"),
    targetEntities: text("target_entities"),
    maxAmount: text("max_amount"),
    subsidyRate: text("subsidy_rate"),
    eligibleThemes: text("eligible_themes"),
    requiredDocuments: text("required_documents"),
    notes: text("notes"),
    aiConfidence: integer("ai_confidence"),
    minamataFitRank: text("minamata_fit_rank"),
    minamataFitScore: integer("minamata_fit_score"),
    minamataFitReason: text("minamata_fit_reason"),
    suggestedDepartment: text("suggested_department"),
    suggestedDepartmentReason: text("suggested_department_reason"),
    minamataUseCase: text("minamata_use_case"),
    minamataCategories: text("minamata_categories"),
    industries: text("industries"),
    themes: text("themes"),
    uniquenessTags: text("uniqueness_tags"),
    scoreBreakdown: text("score_breakdown"),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
  },
  (table) => [
    index("idx_grant_ai_analyses_grant_id").on(table.grantId),
    index("idx_grant_ai_analyses_minamata_fit_rank").on(table.minamataFitRank),
  ]
);

// ── System metadata (key-value) ─────────────────

export const systemMeta = sqliteTable("system_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});
