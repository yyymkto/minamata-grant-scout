import { describe, expect, it } from "vitest";
import {
  getExampleKvScopedKey,
  getExampleUploadObjectKey,
  getExampleUploadPrefix,
} from "../examples/lib/organization-scope";

describe("example organization scope", () => {
  it("prefixes KV keys by organization", () => {
    expect(getExampleKvScopedKey(12, "settings")).toBe("orgs/12/kv/settings");
  });

  it("prefixes uploads by organization", () => {
    expect(getExampleUploadPrefix(12)).toBe("uploads/org_12/");
    expect(getExampleUploadObjectKey(12, "report.csv", 1700000000000)).toBe(
      "uploads/org_12/1700000000000_report.csv"
    );
  });
});
