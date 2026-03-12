import { describe, expect, it } from "vitest";
import { buildAuditLogEntry } from "../src/lib/audit";

describe("audit", () => {
  it("builds an audit log entry from request context", () => {
    const entry = buildAuditLogEntry(
      {
        req: {
          method: "POST",
          path: "/api/items",
          raw: new Request("https://example.com/api/items", {
            method: "POST",
            headers: {
              "cf-connecting-ip": "203.0.113.5",
            },
          }),
        },
        get: (key: string) => (key === "requestId" ? "req_test_123" : undefined),
      } as never,
      {
        actorUserId: 7,
        action: "item.create",
        resourceType: "item",
        resourceId: "42",
        status: 201,
        metadata: { ok: true },
      }
    );

    expect(entry).toMatchObject({
      actorUserId: 7,
      action: "item.create",
      resourceType: "item",
      resourceId: "42",
      requestId: "req_test_123",
      method: "POST",
      path: "/api/items",
      ip: "203.0.113.5",
      status: 201,
    });
    expect(entry.metadataJson).toBe('{"ok":true}');
  });
});
