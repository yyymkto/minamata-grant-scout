import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { loginSchema } from "../../../shared/schemas/auth";
import { rateLimit } from "../../middleware/rate-limit";
import type { AppContextEnv } from "../../types";
import { writeAuditLog } from "../../lib/audit";
import { jsonError } from "../../lib/http";
import { logRequestEvent } from "../../lib/logging";
import {
  ensurePersonalOrganization,
  getMembershipSummaries,
} from "../../lib/organizations";
import { verifyPassword } from "../../lib/password";
import { ensureDefaultUserRole } from "../../lib/rbac";
import { validator } from "../../lib/validator";
import { issueSession } from "./helpers";

const app = new Hono<AppContextEnv>().post(
  "/login",
  rateLimit({ namespace: "auth-login", maxRequests: 10, windowSeconds: 60 }),
  validator("json", loginSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { email, password } = c.req.valid("json");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      logRequestEvent("warn", "auth.login_failed", c, {
        reason: "invalid_credentials",
      });
      await writeAuditLog(c.env.DB, c, {
        action: "auth.login_failed",
        resourceType: "session",
        status: 401,
        metadata: { email },
      });
      return jsonError(c, 401, "invalid_credentials", "Invalid email or password");
    }

    const roles = await ensureDefaultUserRole(db, user.id);
    const organization = await ensurePersonalOrganization(db, user.id, user.name);
    const organizations = await getMembershipSummaries(db, user.id);
    await issueSession(c, c.env, db, user.id, organization.organizationId);
    logRequestEvent("info", "auth.login_success", c, { userId: user.id });
    await writeAuditLog(c.env.DB, c, {
      actorUserId: user.id,
      organizationId: organization.organizationId,
      action: "auth.login",
      resourceType: "session",
      status: 200,
      metadata: { roles, organizationId: organization.organizationId },
    });
    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
      roles,
      currentOrganizationId: organization.organizationId,
      organizations,
    });
  }
);

export default app;
