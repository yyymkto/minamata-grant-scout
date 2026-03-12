import { describe, expect, it } from "vitest";
import { purgeExpiredSessions, purgeStaleAuthTokens } from "../src/db/session-maintenance";

describe("session maintenance", () => {
  it("returns deleted row counts from D1 metadata", async () => {
    const dbBinding = {
      prepare() {
        return {
          bind() {
            return {
              run: async () => ({ success: true, meta: { changes: 2 } }),
            };
          },
        };
      },
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
      dump: async () => new ArrayBuffer(0),
    } as unknown as D1Database;

    expect(await purgeExpiredSessions(dbBinding)).toBe(2);
  });

  it("sums purged auth token counts", async () => {
    const changes = [1, 3];
    const dbBinding = {
      prepare() {
        return {
          bind() {
            return {
              run: async () => ({
                success: true,
                meta: { changes: changes.shift() ?? 0 },
              }),
            };
          },
        };
      },
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
      dump: async () => new ArrayBuffer(0),
    } as unknown as D1Database;

    expect(await purgeStaleAuthTokens(dbBinding)).toBe(4);
  });
});
