import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { AppContextEnv, Env } from "./types";
import health from "./routes/health";
import auth from "./routes/auth";
import orgs from "./routes/orgs";
import modules from "./routes/modules";
import {
  purgeExpiredSessions,
  purgeStaleAuthTokens,
} from "./db/session-maintenance";
import { csrfProtection } from "./middleware/csrf";
import { resolveCorsOrigins } from "./lib/cors";
import { logEvent } from "./lib/logging";
import { RateLimiter } from "./durable-objects/rate-limiter";
import { requestId } from "./middleware/request-id";
import { jsonError } from "./lib/http";
import { handleJobBatch } from "./queues/jobs";

export const app = new Hono<AppContextEnv>()
  .use("*", requestId)
  .use("*", logger())
  .use(
    "*",
    secureHeaders({
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      referrerPolicy: "strict-origin-when-cross-origin",
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    })
  )
  .use(
    "/api/*",
    cors({
      origin: (origin, c) => {
        const allowlist = resolveCorsOrigins(c.env);
        if (!origin) return allowlist[0];
        return allowlist.includes(origin) ? origin : "";
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use("/api/*", csrfProtection)
  .onError((err, c) => {
    logEvent("error", "request.error", {
      method: c.req.method,
      path: c.req.path,
      message: err.message,
      requestId: c.get("requestId"),
    });
    return jsonError(c, 500, "internal_error", "Internal Server Error");
  })
  .route("/api/health", health)
  .route("/api/modules", modules)
  .route("/api/orgs", orgs)
  .route("/api/auth", auth);

export type AppType = typeof app;
export { RateLimiter };
export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env) => {
    const deletedSessions = await purgeExpiredSessions(env.DB);
    if (deletedSessions > 0) {
      logEvent("info", "sessions.purged", { deleted: deletedSessions });
    }

    const deletedAuthTokens = await purgeStaleAuthTokens(env.DB);
    if (deletedAuthTokens > 0) {
      logEvent("info", "auth_tokens.purged", { deleted: deletedAuthTokens });
    }
  },
  queue: handleJobBatch,
};
