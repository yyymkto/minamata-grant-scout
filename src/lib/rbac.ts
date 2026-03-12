import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { roles, userRoles } from "../db/schema";

export const DEFAULT_ROLE = "member";

export function hasRequiredRole(
  assignedRoles: string[],
  requiredRoles: string | string[]
): boolean {
  const expected = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return expected.some((role) => assignedRoles.includes(role));
}

export async function getUserRoleNames(
  db: ReturnType<typeof drizzle>,
  userId: number
): Promise<string[]> {
  const rows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .orderBy(asc(roles.name));

  return rows.map((row) => row.name);
}

export async function ensureUserRole(
  db: ReturnType<typeof drizzle>,
  userId: number,
  roleName: string
): Promise<void> {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, roleName))
    .limit(1);

  if (!role) {
    throw new Error(`role not found: ${roleName}`);
  }

  await db
    .insert(userRoles)
    .values({ userId, roleId: role.id })
    .onConflictDoNothing();
}

export async function ensureDefaultUserRole(
  db: ReturnType<typeof drizzle>,
  userId: number
): Promise<string[]> {
  await ensureUserRole(db, userId, DEFAULT_ROLE);
  return getUserRoleNames(db, userId);
}
