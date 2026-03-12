import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../types";
import { getAppConfig } from "./config";
import { hashOpaqueToken } from "./crypto";

export const HOST_SESSION_COOKIE_NAME = "__Host-session";
export const LEGACY_SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionRecord = {
  id: string;
  userId: number;
  currentOrgId: number | null;
  expiresAt: string;
};

export type SessionRepository = {
  deleteSessionsForUser(userId: number): Promise<void>;
  createSession(session: SessionRecord): Promise<void>;
};

export function resolveCookieOptions(env: Env) {
  const config = getAppConfig(env);
  return {
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
  };
}

export function resolveSessionCookieName(env: Env): string {
  return resolveCookieOptions(env).secure
    ? HOST_SESSION_COOKIE_NAME
    : LEGACY_SESSION_COOKIE_NAME;
}

export function getSessionCookie(c: Context): string | undefined {
  return (
    getCookie(c, HOST_SESSION_COOKIE_NAME) ??
    getCookie(c, LEGACY_SESSION_COOKIE_NAME)
  );
}

export async function rotateSession(
  repository: SessionRepository,
  userId: number,
  currentOrgId: number | null,
  now = Date.now()
): Promise<SessionRecord & { rawId: string }> {
  await repository.deleteSessionsForUser(userId);

  const rawId = crypto.randomUUID();
  const hashedId = await hashOpaqueToken(rawId);

  const session = {
    id: hashedId,
    userId,
    currentOrgId,
    expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  };

  await repository.createSession(session);
  return { ...session, rawId };
}
