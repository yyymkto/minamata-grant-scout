import type { Env } from "../types";
import { getAppConfig } from "./config";

export function resolveCorsOrigins(env: Env): string[] {
  return getAppConfig(env).corsOrigins;
}
