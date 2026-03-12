import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getRequestId } from "./logging";

type ErrorDetails = Record<string, unknown> | undefined;

export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: ErrorDetails
) {
  const requestId = getRequestId(c) ?? null;

  return c.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    },
    status
  );
}
