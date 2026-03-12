import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEmailVerificationEmail,
  buildInviteEmail,
  buildPasswordResetEmail,
  sendEmail,
} from "../src/lib/email";
import { createTestEnv } from "./helpers";

describe("email delivery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds action emails with stable text fallbacks", () => {
    expect(
      buildInviteEmail({
        organizationName: "Taracho Ops",
        role: "member",
        inviteUrl: "https://starter.example.com/invite",
      }).subject
    ).toContain("Taracho Ops");
    expect(
      buildPasswordResetEmail({
        resetUrl: "https://starter.example.com/reset",
      }).text
    ).toContain("Reset your password");
    expect(
      buildEmailVerificationEmail({
        verifyUrl: "https://starter.example.com/verify",
      }).html
    ).toContain("Verify Email");
  });

  it("posts to Resend when configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "re_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const result = await sendEmail(
      createTestEnv({
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "Starter <noreply@example.com>",
        RESEND_API_KEY: "re_test",
      }),
      {
        to: "user@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
        requestId: "req_mail",
        idempotencyKey: "mail:test",
      }
    );

    expect(result).toEqual({ delivery: "resend", id: "re_123" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
          "Idempotency-Key": "mail:test",
        }),
      })
    );
  });
});
