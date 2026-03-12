import { drizzle } from "drizzle-orm/d1";
import { and, isNotNull, lt, or } from "drizzle-orm";
import { emailVerificationTokens, passwordResetTokens, sessions } from "./schema";

export async function purgeExpiredSessions(dbBinding: D1Database): Promise<number> {
  const db = drizzle(dbBinding);
  const now = new Date().toISOString();
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return Number(result.meta.changes ?? 0);
}

export async function purgeStaleAuthTokens(dbBinding: D1Database): Promise<number> {
  const db = drizzle(dbBinding);
  const now = new Date().toISOString();

  const resetResult = await db.delete(passwordResetTokens).where(
    or(
      lt(passwordResetTokens.expiresAt, now),
      isNotNull(passwordResetTokens.usedAt)
    )
  );
  const verificationResult = await db.delete(emailVerificationTokens).where(
    or(
      lt(emailVerificationTokens.expiresAt, now),
      isNotNull(emailVerificationTokens.verifiedAt)
    )
  );

  return Number(resetResult.meta.changes ?? 0) + Number(verificationResult.meta.changes ?? 0);
}
