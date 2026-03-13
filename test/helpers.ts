import type { Env } from "../src/types";

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ASSETS: {
      fetch: async () => new Response("not found", { status: 404 }),
    } as Fetcher,
    CORS_ORIGIN: "http://localhost:5173",
    APP_BASE_URL: "http://localhost:5173",
    ...overrides,
  };
}
