import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { requireOrgRole } from "../src/middleware/require-org-role";
import type { AppContextEnv } from "../src/types";
import { createTestEnv } from "./helpers";

function createApp(orgRole?: string) {
  return new Hono<AppContextEnv>()
    .use("*", async (c, next) => {
      c.set("userId", 1);
      c.set("orgId", 7);
      if (orgRole) c.set("orgRole", orgRole);
      await next();
    })
    .get("/", requireOrgRole(), (c) => c.json({ ok: true }));
}

describe("requireOrgRole", () => {
  it("allows owner and admin roles", async () => {
    const ownerRes = await createApp("owner").fetch(
      new Request("http://local.test/"),
      createTestEnv()
    );
    const adminRes = await createApp("admin").fetch(
      new Request("http://local.test/"),
      createTestEnv()
    );

    expect(ownerRes.status).toBe(200);
    expect(adminRes.status).toBe(200);
  });

  it("rejects non-admin organization roles", async () => {
    const res = await createApp("member").fetch(
      new Request("http://local.test/"),
      createTestEnv()
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: "organization_forbidden",
        message: "Forbidden",
        requestId: null,
      },
    });
  });
});
