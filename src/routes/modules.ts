import { Hono } from "hono";
import type { AppContextEnv } from "../types";
import { getRuntimeModuleStatuses } from "../lib/module-plan";

const app = new Hono<AppContextEnv>().get("/", (c) => {
  const modules = getRuntimeModuleStatuses(c.env);
  return c.json({
    modules,
  });
});

export default app;
