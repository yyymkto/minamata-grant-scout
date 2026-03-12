import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sessions } from "../../db/schema";
import type { AppContextEnv, Env } from "../../types";
import {
  resolveCookieOptions,
  resolveSessionCookieName,
  rotateSession,
  SESSION_MAX_AGE_SECONDS,
} from "../../lib/session";

export function setSessionCookie(c: Context<AppContextEnv>, env: Env, sessionId: string) {
  const { sameSite, secure } = resolveCookieOptions(env);
  setCookie(c, resolveSessionCookieName(env), sessionId, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function issueSession(
  c: Context<AppContextEnv>,
  env: Env,
  db: ReturnType<typeof drizzle>,
  userId: number,
  currentOrgId: number
) {
  const session = await rotateSession(
    {
      deleteSessionsForUser: async (targetUserId) => {
        await db.delete(sessions).where(eq(sessions.userId, targetUserId));
      },
      createSession: async (record) => {
        await db.insert(sessions).values(record);
      },
    },
    userId,
    currentOrgId
  );
  setSessionCookie(c, env, session.rawId);
}
