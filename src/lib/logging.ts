import type { Context } from "hono";

type LogLevel = "info" | "warn" | "error";

export function getClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {}
) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.log(entry);
}

export function getRequestId(c: Context): string | undefined {
  return "get" in c && typeof c.get === "function"
    ? (c.get("requestId") as string | undefined)
    : undefined;
}

export function logRequestEvent(
  level: LogLevel,
  event: string,
  c: Context,
  fields: Record<string, unknown> = {}
) {
  logEvent(level, event, {
    method: c.req.method,
    path: c.req.path,
    ip: getClientIp(c.req.raw.headers),
    requestId: getRequestId(c) ?? null,
    ...fields,
  });
}
