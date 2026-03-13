import { Hono } from "hono";
import type { AppContextEnv } from "../types";

const app = new Hono<AppContextEnv>().get("/", async (c) => {
  const checks: Record<string, string> = {};

  checks.env = c.env.DB ? "ok" : "missing";

  try {
    await c.env.DB.prepare("SELECT 1").first();
    checks.d1 = "ok";
  } catch {
    checks.d1 = "error";
  }

  const status = Object.values(checks).every((v) => v === "ok") ? "ok" : "degraded";
  return c.json({ status, checks });
});

export default app;
