import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sessions } from "../db/schema";
import type { AppContextEnv } from "../types";
import { getSessionCookie } from "../lib/session";
import { hashOpaqueToken } from "../lib/crypto";
import { jsonError } from "../lib/http";
import { getUserRoleNames } from "../lib/rbac";
import {
  getMembershipSummaries,
  pickActiveMembership,
  setSessionOrganization,
} from "../lib/organizations";

export const requireAuth = createMiddleware<AppContextEnv>(async (c, next) => {
  const rawSessionId = getSessionCookie(c);
  if (!rawSessionId) {
    return jsonError(c, 401, "unauthorized", "Authentication required");
  }

  const hashedSessionId = await hashOpaqueToken(rawSessionId);
  const db = drizzle(c.env.DB);
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, hashedSessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date().toISOString()) {
    return jsonError(c, 401, "unauthorized", "Authentication required");
  }

  const roles = await getUserRoleNames(db, session.userId);
  const memberships = await getMembershipSummaries(db, session.userId);
  const activeMembership = pickActiveMembership(
    memberships,
    session.currentOrgId ?? undefined
  );

  if (!activeMembership) {
    return jsonError(c, 403, "organization_required", "Organization membership required");
  }

  if (session.currentOrgId !== activeMembership.organizationId) {
    await setSessionOrganization(db, session.id, activeMembership.organizationId);
  }

  c.set("sessionId", session.id);
  c.set("userId", session.userId);
  c.set("roles", roles);
  c.set("orgId", activeMembership.organizationId);
  c.set("orgRole", activeMembership.membershipRole);
  c.set("memberships", memberships);
  await next();
});
