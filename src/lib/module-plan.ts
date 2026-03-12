import type { Env } from "../types";
import { moduleCatalog } from "../../shared/module-catalog.mjs";

export type ModuleStatus = {
  key: string;
  label: string;
  kind: "core" | "optional";
  enabled: boolean;
  required: string[];
  note: string;
};

type ModuleKey = "jobs" | "rate_limiter" | "kv" | "upload" | "email_delivery";

export function getRuntimeModuleStatuses(env: Env): ModuleStatus[] {
  const emailProvider = env.EMAIL_PROVIDER?.toLowerCase() ?? "log";
  const enabledByKey: Record<ModuleKey, boolean> = {
    jobs: !!env.JOBS,
    rate_limiter: !!env.RATE_LIMITER,
    kv: !!env.KV,
    upload: !!env.BUCKET,
    email_delivery:
      emailProvider === "resend" &&
      !!env.RESEND_API_KEY &&
      !!env.EMAIL_FROM,
  };
  const requiredByKey: Record<ModuleKey, string[]> = {
    jobs: ["JOBS binding"],
    rate_limiter: ["RATE_LIMITER binding"],
    kv: ["KV binding"],
    upload: ["BUCKET binding"],
    email_delivery: ["EMAIL_PROVIDER=resend", "RESEND_API_KEY", "EMAIL_FROM"],
  };

  return moduleCatalog.map((module) => ({
    ...module,
    enabled: enabledByKey[module.key as ModuleKey] ?? false,
    required: requiredByKey[module.key as ModuleKey] ?? [],
    note:
      module.key === "email_delivery" && emailProvider === "resend"
        ? "resend active"
        : module.note,
  }));
}
