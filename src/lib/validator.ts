import { zValidator } from "@hono/zod-validator";
import type { ZodSchema } from "zod";
import { jsonError } from "./http";

export function validator(
  target: "json" | "form" | "query" | "param",
  schema: ZodSchema
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return jsonError(c, 400, "validation_error", "Invalid request", {
        issues: result.error.issues,
      });
    }
  });
}
