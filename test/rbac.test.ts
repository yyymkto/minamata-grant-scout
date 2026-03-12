import { describe, expect, it } from "vitest";
import { hasRequiredRole } from "../src/lib/rbac";

describe("rbac", () => {
  it("allows access when any required role is assigned", () => {
    expect(hasRequiredRole(["member", "admin"], "admin")).toBe(true);
    expect(hasRequiredRole(["member", "editor"], ["admin", "editor"])).toBe(
      true
    );
  });

  it("denies access when no required role is assigned", () => {
    expect(hasRequiredRole(["member"], "admin")).toBe(false);
    expect(hasRequiredRole([], ["admin", "editor"])).toBe(false);
  });
});
