import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { signupSchema } from "../../../shared/schemas/auth";
import { rateLimit } from "../../middleware/rate-limit";
import type { AppContextEnv } from "../../types";
import { writeAuditLog } from "../../lib/audit";
import { resolveAppBaseUrl } from "../../lib/config";
import { jsonError } from "../../lib/http";
import { logRequestEvent } from "../../lib/logging";
import {
  ensurePersonalOrganization,
} from "../../lib/organizations";
import {
  createEmailVerificationToken,
} from "../../lib/email-verification";
import {
  hashPassword,
} from "../../lib/password";
import { ensureDefaultUserRole } from "../../lib/rbac";
import { validator } from "../../lib/validator";
import { enqueueJob } from "../../queues/jobs";
import { issueSession } from "./helpers";

const app = new Hono<AppContextEnv>().post(
  "/signup",
  rateLimit({ namespace: "auth-signup", maxRequests: 5, windowSeconds: 60 }),
  validator("json", signupSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { email, password, name } = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      logRequestEvent("warn", "auth.signup_conflict", c, {});
      return jsonError(c, 409, "email_taken", "Email already registered");
    }

    const passwordHash = await hashPassword(password);
    let user: typeof users.$inferSelect;
    try {
      [user] = await db
        .insert(users)
        .values({ email, passwordHash, name })
        .returning();
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("UNIQUE")) {
        logRequestEvent("warn", "auth.signup_conflict", c, {});
        return jsonError(c, 409, "email_taken", "Email already registered");
      }
      throw e;
    }

    const roles = await ensureDefaultUserRole(db, user.id);
    const organization = await ensurePersonalOrganization(db, user.id, user.name);
    await issueSession(c, c.env, db, user.id, organization.organizationId);
    logRequestEvent("info", "auth.signup_success", c, { userId: user.id });
    await writeAuditLog(c.env.DB, c, {
      actorUserId: user.id,
      organizationId: organization.organizationId,
      action: "auth.signup",
      resourceType: "user",
      resourceId: String(user.id),
      status: 201,
      metadata: { roles, organizationId: organization.organizationId },
    });
    await enqueueJob(c.env.JOBS, {
      type: "user.welcome",
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        requestId: c.get("requestId"),
      },
    });
    const verification = await createEmailVerificationToken(db, user.id);
    await enqueueJob(c.env.JOBS, {
      type: "auth.email_verification_email",
      payload: {
        userId: user.id,
        email: user.email,
        verifyUrl: `${resolveAppBaseUrl(c.env, c.req.url)}/?verifyToken=${verification.token}`,
        requestId: c.get("requestId"),
      },
    });
    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
      roles,
      currentOrganizationId: organization.organizationId,
      organizations: [organization],
    }, 201);
  }
);

export default app;
