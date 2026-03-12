import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
});

export const switchOrganizationSchema = z.object({
  organizationId: z.number().int().positive(),
});

export const organizationInviteRoleSchema = z.enum(["admin", "member"]);

export const createOrganizationInviteSchema = z.object({
  email: z.string().email(),
  role: organizationInviteRoleSchema,
});

export const acceptOrganizationInviteSchema = z.object({
  token: z.string().min(1),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
export type CreateOrganizationInviteInput = z.infer<
  typeof createOrganizationInviteSchema
>;
export type AcceptOrganizationInviteInput = z.infer<
  typeof acceptOrganizationInviteSchema
>;
