import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";

describe("password helpers", () => {
  it("hashes and verifies PBKDF2 passwords", async () => {
    const hashed = await hashPassword("supersecure");

    expect(hashed.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPassword("supersecure", hashed)).toBe(true);
    expect(await verifyPassword("wrong", hashed)).toBe(false);
  });

  it("rejects non-PBKDF2 format as invalid", async () => {
    // Legacy salt:sha256 format is no longer supported (removed 2026-03-11)
    expect(await verifyPassword("anything", "salt:hash")).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});
