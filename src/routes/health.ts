import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppContextEnv } from "../types";
import { getAppConfig } from "../lib/config";
import { getRuntimeModuleStatuses } from "../lib/module-plan";

const app = new Hono<AppContextEnv>().get("/", async (c) => {
  const checks: Record<string, string> = {};
  const modules = getRuntimeModuleStatuses(c.env);

  // Bindings check
  checks.env = c.env.DB && c.env.RATE_LIMITER && c.env.JOBS ? "ok" : "missing";

  try {
    await c.env.DB.prepare("SELECT 1").first();
    checks.d1 = "ok";
  } catch {
    checks.d1 = "error";
  }

  if (c.env.KV) {
    try {
      await c.env.KV.get("_health");
      checks.kv = "ok";
    } catch {
      checks.kv = "error";
    }
  }

  if (c.env.BUCKET) {
    try {
      await c.env.BUCKET.head("_health");
      checks.r2 = "ok";
    } catch {
      checks.r2 = "error";
    }
  }

  try {
    const id = c.env.RATE_LIMITER.idFromName("_health");
    const stub = c.env.RATE_LIMITER.get(id);
    const res = await stub.fetch("https://rate-limiter/ping");
    checks.rateLimiter = res.ok ? "ok" : "error";
  } catch {
    checks.rateLimiter = "error";
  }

  try {
    getAppConfig(c.env);
    checks.config = "ok";
  } catch (error) {
    checks.config = error instanceof ZodError ? "invalid" : "error";
  }

  const status = Object.values(checks).every((v) => v === "ok") ? "ok" : "degraded";
  return c.json({ status, checks, modules });
});

export default app;
