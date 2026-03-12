import { z } from "zod";
import type { Env } from "../types";

const DEFAULT_CORS_ORIGINS = ["http://localhost:5173"];

const originSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim();

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `origin must use http/https: ${trimmed}`,
      });
      return z.NEVER;
    }

    if (parsed.origin !== trimmed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `origin must not include a path/query/hash: ${trimmed}`,
      });
      return z.NEVER;
    }

    return parsed.origin;
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `invalid origin: ${trimmed}`,
    });
    return z.NEVER;
  }
});

const configSchema = z.object({
  corsOrigins: z.array(originSchema).min(1),
  cookieSameSite: z.enum(["Lax", "Strict", "None"]),
  cookieSecure: z.boolean(),
  appBaseUrl: originSchema.optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

const configCache = new WeakMap<Env, AppConfig>();

function normalizeSameSite(raw?: string): "Lax" | "Strict" | "None" {
  if (!raw) return "Lax";
  const normalized = raw[0].toUpperCase() + raw.slice(1).toLowerCase();
  return normalized === "Strict" || normalized === "None" ? normalized : "Lax";
}

function resolveCookieSecure(raw: string | undefined, sameSite: string): boolean {
  if (sameSite === "None") return true;
  if (raw === undefined) return true;
  return raw.toLowerCase() !== "false";
}

function splitOrigins(raw?: string): string[] {
  if (!raw) return DEFAULT_CORS_ORIGINS;
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : DEFAULT_CORS_ORIGINS;
}

export function getAppConfig(env: Env): AppConfig {
  const cached = configCache.get(env);
  if (cached) return cached;

  const sameSite = normalizeSameSite(env.COOKIE_SAME_SITE);
  const parsed = configSchema.parse({
    corsOrigins: splitOrigins(env.CORS_ORIGIN),
    cookieSameSite: sameSite,
    cookieSecure: resolveCookieSecure(env.COOKIE_SECURE, sameSite),
    appBaseUrl: env.APP_BASE_URL?.trim() || undefined,
  });

  configCache.set(env, parsed);
  return parsed;
}

export function resolveAppBaseUrl(env: Env, requestUrl?: string): string {
  const config = getAppConfig(env);
  if (config.appBaseUrl) return config.appBaseUrl;
  if (requestUrl) return new URL(requestUrl).origin;
  return config.corsOrigins[0]!;
}
