import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { auditLogs } from "../db/schema";
import { getClientIp, logEvent } from "./logging";

type AuditLogInput = {
  action: string;
  resourceType: string;
  status: number;
  actorUserId?: number | null;
  organizationId?: number | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function buildAuditLogEntry(c: Context, input: AuditLogInput) {
  const requestId =
    "get" in c && typeof c.get === "function"
      ? (c.get("requestId") as string | undefined)
      : undefined;
  const organizationId =
    input.organizationId ??
    ("get" in c && typeof c.get === "function"
      ? (c.get("orgId") as number | undefined)
      : undefined);

  return {
    actorUserId: input.actorUserId ?? null,
    organizationId: organizationId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    requestId: requestId ?? crypto.randomUUID(),
    method: c.req.method,
    path: c.req.path,
    ip: getClientIp(c.req.raw.headers),
    status: input.status,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
  };
}

export async function writeAuditLog(
  dbBinding: D1Database,
  c: Context,
  input: AuditLogInput
): Promise<void> {
  try {
    const db = drizzle(dbBinding);
    await db.insert(auditLogs).values(buildAuditLogEntry(c, input));
  } catch (error) {
    logEvent("error", "audit.write_failed", {
      action: input.action,
      path: c.req.path,
      method: c.req.method,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
