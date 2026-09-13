import { describe, it, expect } from "vitest";
import { scoreSubsidy } from "../src/features/grants/minamata-scoring-profile";

const today = new Date("2026-09-13"); // R8_KUMAMOTO_EARTHQUAKE modifier is valid until 2028-03-31

describe("scoreSubsidy — time-limited modifier industry scoping", () => {
  it("should NOT grant the earthquake bonus when no industries are classified, even if a disaster theme is matched", () => {
    // Regression test: a subsidy with disaster_resilience theme but zero classified
    // industries (e.g. a mobile-phone infrastructure grant) must not receive the
    // industry-scoped earthquake bonus just because the industry-scope check was
    // previously skipped when `industries` was empty.
    const result = scoreSubsidy({
      industries: [],
      themes: ["population_childcare", "gaika_business", "disaster_resilience"],
      uniquenessTags: [],
      genericMigration: false,
      recruitmentEffectivelyClosed: false,
      notEligibleForMinamata: false,
      today,
    });

    expect(result.breakdown.timeLimitedModifier).toBe(0);
    expect(result.notes.some((n) => n.includes("時限加点"))).toBe(false);
  });

  it("should grant the earthquake bonus when a matching in-scope industry is classified", () => {
    const result = scoreSubsidy({
      industries: ["construction"],
      themes: ["disaster_resilience"],
      uniquenessTags: [],
      genericMigration: false,
      recruitmentEffectivelyClosed: false,
      notEligibleForMinamata: false,
      today,
    });

    expect(result.breakdown.timeLimitedModifier).toBe(10);
  });

  it("should NOT grant the earthquake bonus when the classified industry is out of scope", () => {
    const result = scoreSubsidy({
      industries: ["fisheries"],
      themes: ["disaster_resilience"],
      uniquenessTags: [],
      genericMigration: false,
      recruitmentEffectivelyClosed: false,
      notEligibleForMinamata: false,
      today,
    });

    expect(result.breakdown.timeLimitedModifier).toBe(0);
  });
});
