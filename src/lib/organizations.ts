import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  memberships,
  organizationInvites,
  organizations,
  sessions,
  users,
} from "../db/schema";
import type {
  OrganizationInviteSummary,
  OrganizationMembershipSummary,
} from "../types";
import { hashOpaqueToken } from "./crypto";

export const DEFAULT_ORGANIZATION_ROLE = "owner";
export const ORGANIZATION_ADMIN_ROLES = ["owner", "admin"] as const;
export const ORGANIZATION_INVITE_TTL_DAYS = 7;

export function buildPersonalOrganizationName(name: string): string {
  return `${name}'s Workspace`;
}

export function slugifyOrganizationName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "workspace";
}

function buildUniqueOrganizationSlug(base: string): string {
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveOrganizationInviteStatus(
  invite: Pick<OrganizationInviteSummary, "acceptedAt" | "expiresAt">,
  nowIso = new Date().toISOString()
): OrganizationInviteSummary["status"] {
  if (invite.acceptedAt) return "accepted";
  if (invite.expiresAt < nowIso) return "expired";
  return "pending";
}

export function hasRequiredOrganizationRole(
  assignedRole: string | null | undefined,
  requiredRoles: readonly string[]
): boolean {
  return !!assignedRole && requiredRoles.includes(assignedRole);
}

export async function getMembershipSummaries(
  db: ReturnType<typeof drizzle>,
  userId: number
): Promise<OrganizationMembershipSummary[]> {
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      membershipRole: memberships.role,
    })
    .from(memberships)
    .innerJoin(
      organizations,
      eq(memberships.organizationId, organizations.id)
    )
    .where(eq(memberships.userId, userId))
    .orderBy(asc(organizations.name), asc(organizations.id));

  return rows;
}

export function pickActiveMembership(
  membershipsList: OrganizationMembershipSummary[],
  requestedOrgId?: number | null
): OrganizationMembershipSummary | null {
  if (membershipsList.length === 0) return null;
  if (requestedOrgId === undefined || requestedOrgId === null) {
    return membershipsList[0] ?? null;
  }

  return (
    membershipsList.find(
      (membership) => membership.organizationId === requestedOrgId
    ) ?? membershipsList[0] ?? null
  );
}

export async function createOrganizationForUser(
  db: ReturnType<typeof drizzle>,
  userId: number,
  organizationName: string,
  role = DEFAULT_ORGANIZATION_ROLE
): Promise<OrganizationMembershipSummary> {
  const [organization] = await db
    .insert(organizations)
    .values({
      name: organizationName,
      slug: buildUniqueOrganizationSlug(slugifyOrganizationName(organizationName)),
    })
    .returning();

  await db.insert(memberships).values({
    organizationId: organization.id,
    userId,
    role,
  });

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    membershipRole: role,
  };
}

export async function ensurePersonalOrganization(
  db: ReturnType<typeof drizzle>,
  userId: number,
  displayName: string
): Promise<OrganizationMembershipSummary> {
  const existing = await getMembershipSummaries(db, userId);
  if (existing.length > 0) {
    return existing[0]!;
  }

  return createOrganizationForUser(
    db,
    userId,
    buildPersonalOrganizationName(displayName),
    DEFAULT_ORGANIZATION_ROLE
  );
}

export async function setSessionOrganization(
  db: ReturnType<typeof drizzle>,
  sessionId: string,
  organizationId: number
): Promise<void> {
  await db
    .update(sessions)
    .set({ currentOrgId: organizationId })
    .where(eq(sessions.id, sessionId));
}

export async function createOrganizationInvite(
  db: ReturnType<typeof drizzle>,
  input: {
    organizationId: number;
    email: string;
    role: string;
    createdByUserId: number;
  }
): Promise<OrganizationInviteSummary & { token: string }> {
  const token = crypto.randomUUID();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(
    Date.now() + ORGANIZATION_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const [invite] = await db
    .insert(organizationInvites)
    .values({
      organizationId: input.organizationId,
      email: normalizeInviteEmail(input.email),
      role: input.role,
      tokenHash,
      createdByUserId: input.createdByUserId,
      expiresAt,
    })
    .returning();

  return {
    id: invite.id,
    organizationId: invite.organizationId,
    email: invite.email,
    role: invite.role,
    status: resolveOrganizationInviteStatus({
      acceptedAt: invite.acceptedAt,
      expiresAt: invite.expiresAt,
    }),
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt ?? null,
    createdAt: invite.createdAt,
    token,
  };
}

export async function listOrganizationInvites(
  db: ReturnType<typeof drizzle>,
  organizationId: number
): Promise<OrganizationInviteSummary[]> {
  const rows = await db
    .select({
      id: organizationInvites.id,
      organizationId: organizationInvites.organizationId,
      email: organizationInvites.email,
      role: organizationInvites.role,
      expiresAt: organizationInvites.expiresAt,
      acceptedAt: organizationInvites.acceptedAt,
      createdAt: organizationInvites.createdAt,
    })
    .from(organizationInvites)
    .where(eq(organizationInvites.organizationId, organizationId))
    .orderBy(asc(organizationInvites.createdAt), asc(organizationInvites.id));

  return rows.map((row) => ({
    ...row,
    acceptedAt: row.acceptedAt ?? null,
    status: resolveOrganizationInviteStatus({
      acceptedAt: row.acceptedAt,
      expiresAt: row.expiresAt,
    }),
  }));
}

export type AcceptOrganizationInviteResult =
  | {
      ok: true;
      membership: OrganizationMembershipSummary;
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "expired"
        | "already_accepted"
        | "email_mismatch";
      inviteOrganizationId?: number;
    };

export async function acceptOrganizationInvite(
  db: ReturnType<typeof drizzle>,
  input: {
    token: string;
    userId: number;
    userEmail: string;
  }
): Promise<AcceptOrganizationInviteResult> {
  const tokenHash = await hashOpaqueToken(input.token);
  const [invite] = await db
    .select({
      id: organizationInvites.id,
      organizationId: organizationInvites.organizationId,
      email: organizationInvites.email,
      role: organizationInvites.role,
      acceptedAt: organizationInvites.acceptedAt,
      expiresAt: organizationInvites.expiresAt,
    })
    .from(organizationInvites)
    .where(eq(organizationInvites.tokenHash, tokenHash))
    .limit(1);

  if (!invite) {
    return { ok: false, reason: "not_found" };
  }

  if (invite.acceptedAt) {
    return {
      ok: false,
      reason: "already_accepted",
      inviteOrganizationId: invite.organizationId,
    };
  }

  if (invite.expiresAt < new Date().toISOString()) {
    return {
      ok: false,
      reason: "expired",
      inviteOrganizationId: invite.organizationId,
    };
  }

  if (normalizeInviteEmail(input.userEmail) !== normalizeInviteEmail(invite.email)) {
    return {
      ok: false,
      reason: "email_mismatch",
      inviteOrganizationId: invite.organizationId,
    };
  }

  await db
    .insert(memberships)
    .values({
      organizationId: invite.organizationId,
      userId: input.userId,
      role: invite.role,
    })
    .onConflictDoNothing();

  await db
    .update(organizationInvites)
    .set({
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: input.userId,
    })
    .where(
      and(
        eq(organizationInvites.id, invite.id),
        eq(organizationInvites.tokenHash, tokenHash)
      )
    );

  const membershipsList = await getMembershipSummaries(db, input.userId);
  const membership = membershipsList.find(
    (item) => item.organizationId === invite.organizationId
  );

  if (!membership) {
    throw new Error("accepted invite did not create membership");
  }

  return { ok: true, membership };
}

export async function getUserEmail(
  db: ReturnType<typeof drizzle>,
  userId: number
): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.email ?? null;
}
