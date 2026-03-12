import { describe, expect, it } from "vitest";
import { resolveEmailVerificationStatus } from "../src/lib/email-verification";

describe("email verification helpers", () => {
  it("resolves pending, verified, and expired statuses", () => {
    expect(
      resolveEmailVerificationStatus({
        verifiedAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      })
    ).toBe("pending");
    expect(
      resolveEmailVerificationStatus({
        verifiedAt: "2026-03-09T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
      })
    ).toBe("verified");
    expect(
      resolveEmailVerificationStatus(
        {
          verifiedAt: null,
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
        "2026-03-09T00:00:00.000Z"
      )
    ).toBe("expired");
  });
});
