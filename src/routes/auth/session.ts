import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sessions, users } from "../../db/schema";
import { switchOrganizationSchema } from "../../../shared/schemas/orgs";
import { requireAuth } from "../../middleware/auth";
import type { AppContextEnv } from "../../types";
import {
  HOST_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  resolveCookieOptions,
} from "../../lib/session";
import { writeAuditLog } from "../../lib/audit";
import { jsonError } from "../../lib/http";
import {
  setSessionOrganization,
} from "../../lib/organizations";
import { validator } from "../../lib/validator";

const app = new Hono<AppContextEnv>()
  .post("/logout", requireAuth, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    if (!userId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }
    const { sameSite, secure } = resolveCookieOptions(c.env);

    await db.delete(sessions).where(eq(sessions.userId, userId));
    deleteCookie(c, HOST_SESSION_COOKIE_NAME, {
      path: "/",
      sameSite,
      secure: true,
    });
    deleteCookie(c, LEGACY_SESSION_COOKIE_NAME, { path: "/", sameSite, secure });
    await writeAuditLog(c.env.DB, c, {
      actorUserId: userId,
      organizationId: c.get("orgId") ?? null,
      action: "auth.logout",
      resourceType: "session",
      status: 200,
    });
    return c.json({ ok: true });
  })
  .post(
    "/switch-org",
    requireAuth,
    validator("json", switchOrganizationSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const sessionId = c.get("sessionId");
      const userId = c.get("userId");
      const memberships = c.get("memberships") ?? [];
      const { organizationId } = c.req.valid("json");

      if (!sessionId || !userId) {
        return jsonError(c, 401, "unauthorized", "Authentication required");
      }

      const membership = memberships.find(
        (item) => item.organizationId === organizationId
      );

      if (!membership) {
        await writeAuditLog(c.env.DB, c, {
          actorUserId: userId,
          action: "auth.switch_org_denied",
          resourceType: "organization",
          resourceId: String(organizationId),
          status: 403,
        });
        return jsonError(c, 403, "organization_access_denied", "Forbidden");
      }

      await setSessionOrganization(db, sessionId, organizationId);
      await writeAuditLog(c.env.DB, c, {
        actorUserId: userId,
        organizationId,
        action: "auth.switch_org",
        resourceType: "organization",
        resourceId: String(organizationId),
        status: 200,
      });

      c.set("orgId", membership.organizationId);
      c.set("orgRole", membership.membershipRole);
      return c.json({
        ok: true,
        currentOrganizationId: membership.organizationId,
        organizationRole: membership.membershipRole,
      });
    }
  )
  .get("/me", requireAuth, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    if (!userId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }
    const roles = c.get("roles") ?? [];
    const memberships = c.get("memberships") ?? [];
    const currentOrganizationId = c.get("orgId") ?? null;
    const organizationRole = c.get("orgRole") ?? null;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return jsonError(c, 404, "not_found", "User not found");
    }

    return c.json({
      ...user,
      roles,
      currentOrganizationId,
      organizationRole,
      organizations: memberships,
    });
  });

export default app;
