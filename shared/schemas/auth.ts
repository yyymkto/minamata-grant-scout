import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8).max(128),
});

export const signupSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const emailVerificationRequestSchema = z.object({});

export const emailVerificationConfirmSchema = z.object({
  token: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordResetConfirmInput = z.infer<
  typeof passwordResetConfirmSchema
>;
export type EmailVerificationRequestInput = z.infer<
  typeof emailVerificationRequestSchema
>;
export type EmailVerificationConfirmInput = z.infer<
  typeof emailVerificationConfirmSchema
>;
