import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { passwordResetTokens, sessions, users } from "../../db/schema";
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from "../../../shared/schemas/auth";
import { rateLimit } from "../../middleware/rate-limit";
import type { AppContextEnv } from "../../types";
import { writeAuditLog } from "../../lib/audit";
import { resolveAppBaseUrl } from "../../lib/config";
import { jsonError } from "../../lib/http";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
} from "../../lib/password-reset";
import { hashPassword } from "../../lib/password";
import { validator } from "../../lib/validator";
import { enqueueJob } from "../../queues/jobs";

const app = new Hono<AppContextEnv>()
  .post(
    "/password-reset/request",
    rateLimit({
      namespace: "auth-password-reset-request",
      maxRequests: 5,
      windowSeconds: 60,
    }),
    validator("json", passwordResetRequestSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { email } = c.req.valid("json");

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user) {
        const reset = await createPasswordResetToken(db, user.id);
        await enqueueJob(c.env.JOBS, {
          type: "auth.password_reset_email",
          payload: {
            userId: user.id,
            email: user.email,
            resetUrl: `${resolveAppBaseUrl(c.env, c.req.url)}/?resetToken=${reset.token}`,
            requestId: c.get("requestId"),
          },
        });
        await writeAuditLog(c.env.DB, c, {
          actorUserId: user.id,
          action: "auth.password_reset_request",
          resourceType: "password_reset",
          resourceId: String(reset.id),
          status: 200,
        });
      } else {
        await writeAuditLog(c.env.DB, c, {
          action: "auth.password_reset_request",
          resourceType: "password_reset",
          status: 200,
          metadata: { email },
        });
      }

      return c.json({ ok: true });
    }
  )
  .post(
    "/password-reset/confirm",
    rateLimit({
      namespace: "auth-password-reset-confirm",
      maxRequests: 10,
      windowSeconds: 60,
    }),
    validator("json", passwordResetConfirmSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { token, password } = c.req.valid("json");
      const result = await consumePasswordResetToken(db, token);

      if (!result.ok) {
        const codeByReason = {
          not_found: ["password_reset_not_found", 404],
          expired: ["password_reset_expired", 410],
          used: ["password_reset_used", 409],
        } as const;
        const [code, status] = codeByReason[result.reason];
        await writeAuditLog(c.env.DB, c, {
          action: "auth.password_reset_confirm_denied",
          resourceType: "password_reset",
          status,
          metadata: { reason: result.reason },
        });
        return jsonError(c, status, code, "Forbidden");
      }

      const passwordHash = await hashPassword(password);
      try {
        await db
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, result.userId));
        await db.delete(sessions).where(eq(sessions.userId, result.userId));
      } catch (err) {
        // Roll back token consumption if password update fails
        await db
          .update(passwordResetTokens)
          .set({ usedAt: null })
          .where(eq(passwordResetTokens.id, result.tokenId));
        throw err;
      }

      await writeAuditLog(c.env.DB, c, {
        actorUserId: result.userId,
        action: "auth.password_reset_confirm",
        resourceType: "password_reset",
        resourceId: String(result.tokenId),
        status: 200,
      });

      return c.json({ ok: true });
    }
  );

export default app;
