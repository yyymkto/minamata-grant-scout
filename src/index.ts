import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { AppContextEnv } from "./types";
import health from "./routes/health";
import grantsRoutes from "./routes/grants";
import { csrfProtection } from "./middleware/csrf";
import { resolveCorsOrigins } from "./lib/cors";
import { logEvent } from "./lib/logging";
import { requestId } from "./middleware/request-id";
import { jsonError } from "./lib/http";

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
  .route("/api/grants", grantsRoutes);

export type AppType = typeof app;
export default {
  fetch: app.fetch,
};
