import { describe, expect, it } from "vitest";
import { resolvePasswordResetStatus } from "../src/lib/password-reset";

describe("password reset helpers", () => {
  it("resolves pending, used, and expired statuses", () => {
    expect(
      resolvePasswordResetStatus({
        usedAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      })
    ).toBe("pending");
    expect(
      resolvePasswordResetStatus({
        usedAt: "2026-03-09T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
      })
    ).toBe("used");
    expect(
      resolvePasswordResetStatus(
        {
          usedAt: null,
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
        "2026-03-09T00:00:00.000Z"
      )
    ).toBe("expired");
  });
});
