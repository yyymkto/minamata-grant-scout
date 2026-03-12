import { and, eq, isNull, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { passwordResetTokens } from "../db/schema";
import { hashOpaqueToken } from "./crypto";

export const PASSWORD_RESET_TTL_HOURS = 2;

export function resolvePasswordResetStatus(
  token: { usedAt: string | null; expiresAt: string },
  nowIso = new Date().toISOString()
): "pending" | "used" | "expired" {
  if (token.usedAt) return "used";
  if (token.expiresAt < nowIso) return "expired";
  return "pending";
}

export async function createPasswordResetToken(
  db: ReturnType<typeof drizzle>,
  userId: number
) {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

  const token = crypto.randomUUID();
  const tokenHash = await hashOpaqueToken(token);
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  const [row] = await db
    .insert(passwordResetTokens)
    .values({
      userId,
      tokenHash,
      expiresAt,
    })
    .returning();

  return {
    id: row.id,
    token,
    expiresAt: row.expiresAt,
  };
}

export async function consumePasswordResetToken(
  db: ReturnType<typeof drizzle>,
  token: string
): Promise<
  | { ok: true; userId: number; tokenId: number }
  | { ok: false; reason: "not_found" | "expired" | "used" }
> {
  const tokenHash = await hashOpaqueToken(token);
  const nowIso = new Date().toISOString();

  // Atomic: UPDATE ... WHERE unused AND not expired ... RETURNING
  const [updated] = await db
    .update(passwordResetTokens)
    .set({ usedAt: nowIso })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, nowIso)
      )
    )
    .returning({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
    });

  if (updated) {
    return { ok: true, userId: updated.userId, tokenId: updated.id };
  }

  // No row updated — determine why for the appropriate error response
  const [row] = await db
    .select({
      usedAt: passwordResetTokens.usedAt,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) return { ok: false, reason: "not_found" };
  if (row.usedAt) return { ok: false, reason: "used" };
  return { ok: false, reason: "expired" };
}
