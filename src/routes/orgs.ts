import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { requireAuth } from "../middleware/auth";
import type { AppContextEnv } from "../types";
import {
  acceptOrganizationInvite,
  createOrganizationForUser,
  createOrganizationInvite,
  getMembershipSummaries,
  getUserEmail,
  listOrganizationInvites,
  setSessionOrganization,
} from "../lib/organizations";
import { writeAuditLog } from "../lib/audit";
import { jsonError } from "../lib/http";
import { resolveAppBaseUrl } from "../lib/config";
import { validator } from "../lib/validator";
import {
  acceptOrganizationInviteSchema,
  createOrganizationInviteSchema,
  createOrganizationSchema,
} from "../../shared/schemas/orgs";
import { requireOrgRole } from "../middleware/require-org-role";
import { enqueueJob } from "../queues/jobs";

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    return c.json({
      currentOrganizationId: c.get("orgId") ?? null,
      organizationRole: c.get("orgRole") ?? null,
      organizations: c.get("memberships") ?? [],
    });
  })
  .post("/", validator("json", createOrganizationSchema), async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    const sessionId = c.get("sessionId");

    if (!userId || !sessionId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }

    const { name } = c.req.valid("json");
    const organization = await createOrganizationForUser(db, userId, name);
    await setSessionOrganization(db, sessionId, organization.organizationId);
    const organizations = await getMembershipSummaries(db, userId);

    await writeAuditLog(c.env.DB, c, {
      actorUserId: userId,
      organizationId: organization.organizationId,
      action: "organization.create",
      resourceType: "organization",
      resourceId: String(organization.organizationId),
      status: 201,
      metadata: { name: organization.organizationName },
    });

    c.set("orgId", organization.organizationId);
    c.set("orgRole", organization.membershipRole);
    c.set("memberships", organizations);

    return c.json(
      {
        organization,
        currentOrganizationId: organization.organizationId,
        organizations,
      },
      201
    );
  })
  .get("/current/invites", requireOrgRole(), async (c) => {
    const db = drizzle(c.env.DB);
    const organizationId = c.get("orgId");

    if (!organizationId) {
      return jsonError(c, 403, "organization_required", "Organization required");
    }

    const invites = await listOrganizationInvites(db, organizationId);
    return c.json({
      currentOrganizationId: organizationId,
      invites,
    });
  })
  .post(
    "/current/invites",
    requireOrgRole(),
    validator("json", createOrganizationInviteSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const organizationId = c.get("orgId");
      const userId = c.get("userId");

      if (!organizationId || !userId) {
        return jsonError(c, 401, "unauthorized", "Authentication required");
      }

      const { email, role } = c.req.valid("json");
      const invite = await createOrganizationInvite(db, {
        organizationId,
        email,
        role,
        createdByUserId: userId,
      });

      await writeAuditLog(c.env.DB, c, {
        actorUserId: userId,
        organizationId,
        action: "organization.invite_create",
        resourceType: "organization_invite",
        resourceId: String(invite.id),
        status: 201,
        metadata: {
          email: invite.email,
          role: invite.role,
        },
      });

      await enqueueJob(c.env.JOBS, {
        type: "organization.invite_email",
        payload: {
          organizationId,
          organizationName:
            (
              (c.get("memberships") ?? []).find(
                (membership) => membership.organizationId === organizationId
              ) ?? null
            )?.organizationName ?? `Organization ${organizationId}`,
          inviteId: invite.id,
          email: invite.email,
          role: invite.role,
          inviteUrl: `${resolveAppBaseUrl(c.env, c.req.url)}/?inviteToken=${invite.token}`,
          requestId: c.get("requestId"),
        },
      });

      return c.json(
        {
          invite,
        },
        201
      );
    }
  )
  .post(
    "/invites/accept",
    validator("json", acceptOrganizationInviteSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const userId = c.get("userId");
      const sessionId = c.get("sessionId");

      if (!userId || !sessionId) {
        return jsonError(c, 401, "unauthorized", "Authentication required");
      }

      const userEmail = await getUserEmail(db, userId);
      if (!userEmail) {
        return jsonError(c, 404, "not_found", "User not found");
      }

      const { token } = c.req.valid("json");
      const result = await acceptOrganizationInvite(db, {
        token,
        userId,
        userEmail,
      });

      if (!result.ok) {
        const codeByReason = {
          not_found: ["organization_invite_not_found", 404],
          expired: ["organization_invite_expired", 410],
          already_accepted: ["organization_invite_already_accepted", 409],
          email_mismatch: ["organization_invite_email_mismatch", 403],
        } as const;

        const [code, status] = codeByReason[result.reason];
        await writeAuditLog(c.env.DB, c, {
          actorUserId: userId,
          organizationId: result.inviteOrganizationId ?? null,
          action: "organization.invite_accept_denied",
          resourceType: "organization_invite",
          status,
          metadata: { reason: result.reason },
        });
        return jsonError(c, status, code, "Forbidden");
      }

      await setSessionOrganization(
        db,
        sessionId,
        result.membership.organizationId
      );

      const organizations = await getMembershipSummaries(db, userId);
      c.set("orgId", result.membership.organizationId);
      c.set("orgRole", result.membership.membershipRole);
      c.set("memberships", organizations);

      await writeAuditLog(c.env.DB, c, {
        actorUserId: userId,
        organizationId: result.membership.organizationId,
        action: "organization.invite_accept",
        resourceType: "organization_invite",
        status: 200,
        metadata: {
          organizationRole: result.membership.membershipRole,
        },
      });

      return c.json({
        ok: true,
        currentOrganizationId: result.membership.organizationId,
        organizationRole: result.membership.membershipRole,
        organizations,
      });
  });

export default app;
