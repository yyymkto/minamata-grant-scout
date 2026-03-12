import { describe, expect, it, vi } from "vitest";
import { logEvent } from "../src/lib/logging";

describe("logEvent", () => {
  it("writes structured JSON to the expected console method", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logEvent("warn", "auth.login_failed", { reason: "invalid_credentials" });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.level).toBe("warn");
    expect(payload.event).toBe("auth.login_failed");
    expect(payload.reason).toBe("invalid_credentials");

    spy.mockRestore();
  });
});
