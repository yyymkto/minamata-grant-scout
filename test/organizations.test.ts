import { describe, expect, it } from "vitest";
import {
  buildPersonalOrganizationName,
  hasRequiredOrganizationRole,
  pickActiveMembership,
  resolveOrganizationInviteStatus,
  slugifyOrganizationName,
} from "../src/lib/organizations";

describe("organizations", () => {
  it("builds a readable personal workspace name", () => {
    expect(buildPersonalOrganizationName("Taracho")).toBe("Taracho's Workspace");
  });

  it("slugifies organization names for URLs", () => {
    expect(slugifyOrganizationName("Taracho Regional Tools")).toBe(
      "taracho-regional-tools"
    );
    expect(slugifyOrganizationName("  !!!  ")).toBe("workspace");
  });

  it("selects the requested active organization when available", () => {
    const memberships = [
      {
        organizationId: 1,
        organizationName: "Alpha",
        organizationSlug: "alpha",
        membershipRole: "owner",
      },
      {
        organizationId: 2,
        organizationName: "Beta",
        organizationSlug: "beta",
        membershipRole: "member",
      },
    ];

    expect(pickActiveMembership(memberships, 2)?.organizationSlug).toBe("beta");
    expect(pickActiveMembership(memberships, 999)?.organizationSlug).toBe(
      "alpha"
    );
  });

  it("resolves organization invite status", () => {
    expect(
      resolveOrganizationInviteStatus({
        acceptedAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      })
    ).toBe("pending");
    expect(
      resolveOrganizationInviteStatus({
        acceptedAt: "2026-03-09T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
      })
    ).toBe("accepted");
    expect(
      resolveOrganizationInviteStatus(
        {
          acceptedAt: null,
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
        "2026-03-09T00:00:00.000Z"
      )
    ).toBe("expired");
  });

  it("checks organization admin roles", () => {
    expect(hasRequiredOrganizationRole("owner", ["owner", "admin"])).toBe(true);
    expect(hasRequiredOrganizationRole("admin", ["owner", "admin"])).toBe(true);
    expect(hasRequiredOrganizationRole("member", ["owner", "admin"])).toBe(false);
    expect(hasRequiredOrganizationRole(null, ["owner", "admin"])).toBe(false);
  });
});
