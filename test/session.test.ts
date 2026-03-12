import { describe, expect, it, vi } from "vitest";
import {
  HOST_SESSION_COOKIE_NAME,
  resolveCookieOptions,
  resolveSessionCookieName,
  rotateSession,
} from "../src/lib/session";
import type { SessionRecord } from "../src/lib/session";
import { createTestEnv } from "./helpers";

describe("session helpers", () => {
  it("uses a __Host- cookie name and enforces secure cookies for SameSite=None", () => {
    expect(HOST_SESSION_COOKIE_NAME).toBe("__Host-session");
    expect(resolveSessionCookieName(createTestEnv())).toBe("__Host-session");
    expect(
      resolveCookieOptions(
        createTestEnv({
          COOKIE_SAME_SITE: "None",
          COOKIE_SECURE: "false",
        })
      )
    ).toEqual({
      sameSite: "None",
      secure: true,
    });
  });

  it("rotates sessions so only one active session remains per user", async () => {
    const sessions = new Map<number, SessionRecord[]>();
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("first-session")
      .mockReturnValueOnce("second-session");

    const repository = {
      deleteSessionsForUser: async (userId: number) => {
        sessions.set(userId, []);
      },
      createSession: async (session: SessionRecord) => {
        sessions.set(session.userId, [session]);
      },
    };

    await rotateSession(repository, 7, 10, Date.UTC(2026, 0, 1));
    const rotated = await rotateSession(repository, 7, 11, Date.UTC(2026, 0, 2));

    expect(rotated.rawId).toBe("second-session");
    expect(rotated.id).not.toBe("second-session"); // id is hashed
    expect(rotated.currentOrgId).toBe(11);
    // DB stores the hashed session, not the raw one
    const stored = sessions.get(7);
    expect(stored).toHaveLength(1);
    expect(stored![0].id).toBe(rotated.id);

    uuidSpy.mockRestore();
  });
});
