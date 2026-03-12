import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import {
  emailVerificationConfirmSchema,
  emailVerificationRequestSchema,
} from "../../../shared/schemas/auth";
import { requireAuth } from "../../middleware/auth";
import { rateLimit } from "../../middleware/rate-limit";
import type { AppContextEnv } from "../../types";
import { writeAuditLog } from "../../lib/audit";
import { resolveAppBaseUrl } from "../../lib/config";
import { jsonError } from "../../lib/http";
import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
} from "../../lib/email-verification";
import { validator } from "../../lib/validator";
import { enqueueJob } from "../../queues/jobs";

const app = new Hono<AppContextEnv>()
  .post(
    "/email-verification/request",
    requireAuth,
    validator("json", emailVerificationRequestSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const userId = c.get("userId");

      if (!userId) {
        return jsonError(c, 401, "unauthorized", "Authentication required");
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return jsonError(c, 404, "not_found", "User not found");
      }

      if (!user.emailVerifiedAt) {
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
      }

      await writeAuditLog(c.env.DB, c, {
        actorUserId: user.id,
        organizationId: c.get("orgId") ?? null,
        action: "auth.email_verification_request",
        resourceType: "email_verification",
        status: 200,
        metadata: { alreadyVerified: !!user.emailVerifiedAt },
      });

      return c.json({ ok: true, emailVerifiedAt: user.emailVerifiedAt ?? null });
    }
  )
  .post(
    "/email-verification/confirm",
    rateLimit({ namespace: "auth-email-verify", maxRequests: 10, windowSeconds: 60 }),
    validator("json", emailVerificationConfirmSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { token } = c.req.valid("json");
      const result = await consumeEmailVerificationToken(db, token);

      if (!result.ok) {
        const codeByReason = {
          not_found: ["email_verification_not_found", 404],
          expired: ["email_verification_expired", 410],
          verified: ["email_verification_verified", 409],
        } as const;
        const [code, status] = codeByReason[result.reason];
        await writeAuditLog(c.env.DB, c, {
          action: "auth.email_verification_confirm_denied",
          resourceType: "email_verification",
          status,
          metadata: { reason: result.reason },
        });
        return jsonError(c, status, code, "Forbidden");
      }

      await writeAuditLog(c.env.DB, c, {
        actorUserId: result.userId,
        action: "auth.email_verification_confirm",
        resourceType: "email_verification",
        resourceId: String(result.tokenId),
        status: 200,
      });

      return c.json({
        ok: true,
        emailVerifiedAt: result.emailVerifiedAt,
      });
    }
  );

export default app;
