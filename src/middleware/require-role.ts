import { createMiddleware } from "hono/factory";
import type { AppContextEnv } from "../types";
import { writeAuditLog } from "../lib/audit";
import { jsonError } from "../lib/http";
import { logRequestEvent } from "../lib/logging";
import { hasRequiredRole } from "../lib/rbac";

export function requireRole(requiredRoles: string | string[]) {
  const expected = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return createMiddleware<AppContextEnv>(async (c, next) => {
    const userId = c.get("userId");
    const assignedRoles = c.get("roles") ?? [];

    if (!userId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }

    if (!hasRequiredRole(assignedRoles, expected)) {
      logRequestEvent("warn", "auth.role_forbidden", c, {
        userId,
        assignedRoles,
        requiredRoles: expected,
      });

      await writeAuditLog(c.env.DB, c, {
        actorUserId: userId,
        action: "auth.role_forbidden",
        resourceType: "authorization",
        status: 403,
        metadata: {
          assignedRoles,
          requiredRoles: expected,
        },
      });

      return jsonError(c, 403, "forbidden", "Forbidden");
    }

    await next();
  });
}
