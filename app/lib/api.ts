import { hc } from "hono/client";
import type { AppType } from "@server/index";

export const client = hc<AppType>("/", {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
});
