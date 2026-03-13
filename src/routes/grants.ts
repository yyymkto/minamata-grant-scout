import { Hono } from "hono";
import { desc, eq, like, and, or, count, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { grants, grantAiAnalyses } from "../db/schema";
import type { AppContextEnv } from "../types";
import { jsonError } from "../lib/http";
import { ingestGrantList } from "../features/grants/ingest";

const app = new Hono<AppContextEnv>()
  // LIST with filters
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const rank = c.req.query("rank");
    const ministry = c.req.query("ministry");
    const department = c.req.query("department");
    const category = c.req.query("category");
    const q = c.req.query("q");
    const includeEnded = c.req.query("include_ended");

    const rows = await db
      .select({
        id: grants.id,
        title: grants.title,
        sourceMinistry: grants.sourceMinistry,
        sourceUrl: grants.sourceUrl,
        publishedAt: grants.publishedAt,
        deadline: grants.deadline,
        categoryRaw: grants.categoryRaw,
        createdAt: grants.createdAt,
        summaryShort: grantAiAnalyses.summaryShort,
        taraFitRank: grantAiAnalyses.taraFitRank,
        taraFitScore: grantAiAnalyses.taraFitScore,
        suggestedDepartment: grantAiAnalyses.suggestedDepartment,
        maxAmount: grantAiAnalyses.maxAmount,
        taraCategories: grantAiAnalyses.taraCategories,
      })
      .from(grants)
      .leftJoin(grantAiAnalyses, eq(grants.id, grantAiAnalyses.grantId))
      .orderBy(desc(grants.deadline));

    let filtered = rows;

    if (rank) {
      filtered = filtered.filter((r) => r.taraFitRank === rank);
    } else {
      // デフォルトでCランクを除外（rank=C で明示指定すれば取得可能）
      filtered = filtered.filter((r) => r.taraFitRank !== "C");
    }
    if (ministry) {
      filtered = filtered.filter((r) => r.sourceMinistry === ministry);
    }
    if (category) {
      filtered = filtered.filter((r) => r.taraCategories?.split(",").includes(category));
    }
    if (department) {
      filtered = filtered.filter((r) => r.suggestedDepartment?.includes(department));
    }
    if (q) {
      const lower = q.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(lower) ||
          r.summaryShort?.toLowerCase().includes(lower)
      );
    }
    // デフォルトで締切済みを除外。include_ended=true で過去90日分を表示
    const today = new Date().toISOString().slice(0, 10);
    if (includeEnded === "true") {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      filtered = filtered.filter((r) => !r.deadline || r.deadline >= cutoff);
    } else {
      filtered = filtered.filter((r) => !r.deadline || r.deadline >= today);
    }

    return c.json(filtered);
  })
  // ステータス（最終更新日時・件数）
  .get("/status", async (c) => {
    const db = drizzle(c.env.DB);
    const [grantStats] = await db
      .select({ total: count(), lastUpdated: max(grants.createdAt) })
      .from(grants);
    const [analysisStats] = await db
      .select({ total: count() })
      .from(grantAiAnalyses);

    return c.json({
      grants: grantStats?.total ?? 0,
      analyzed: analysisStats?.total ?? 0,
      lastUpdated: grantStats?.lastUpdated ?? null,
    });
  })
  // GET ONE with full analysis
  .get("/:id", async (c) => {
    const db = drizzle(c.env.DB);
    const id = Number(c.req.param("id"));

    const [grant] = await db
      .select()
      .from(grants)
      .where(eq(grants.id, id));

    if (!grant) {
      return jsonError(c, 404, "not_found", "Grant not found");
    }

    const [analysis] = await db
      .select()
      .from(grantAiAnalyses)
      .where(eq(grantAiAnalyses.grantId, id));

    return c.json({ ...grant, analysis: analysis ?? null });
  })
  // 手動ingestトリガー（ADMIN_SECRET必須）
  .post("/ingest", async (c) => {
    const secret = c.req.header("x-admin-secret");
    if (!c.env.ADMIN_SECRET || secret !== c.env.ADMIN_SECRET) {
      return jsonError(c, 401, "unauthorized", "Invalid admin secret");
    }

    const result = await ingestGrantList(c.env);
    return c.json(result);
  });

export default app;
