import { createMiddleware } from "hono/factory";
import type { AppContextEnv } from "../types";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

function resolveRequestId(raw?: string): string {
  if (raw && REQUEST_ID_PATTERN.test(raw)) {
    return raw;
  }
  return crypto.randomUUID();
}

export const requestId = createMiddleware<AppContextEnv>(async (c, next) => {
  const id = resolveRequestId(c.req.header("x-request-id"));
  c.set("requestId", id);

  await next();

  c.header("X-Request-Id", id);
});
