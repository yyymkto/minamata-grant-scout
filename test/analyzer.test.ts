import { describe, it, expect, vi } from "vitest";
import { analysisSchema, analyzeGrant } from "../src/features/grants/analyzer";
import type { Env, WorkersAiBinding } from "../src/types";

const BASE_FIELDS = {
  summary_short: "【対象】... 【使途】... 【補助】... 【アクション】...",
  support_type: "補助金",
  target_entities: "事業者",
  max_amount: null,
  subsidy_rate: null,
  eligible_themes: "",
  required_documents: null,
  notes: null,
  ai_confidence: 50,
  generic_migration: false,
  recruitment_effectively_closed: false,
  not_eligible_for_minamata: false,
  minamata_fit_reason: "",
  suggested_department: "",
  suggested_department_reason: "",
  minamata_use_case: "",
  minamata_categories: [],
};

describe("analysisSchema — classification plausibility guardrail", () => {
  it("should reject a response that echoes (almost) the entire theme list instead of classifying", () => {
    // Regression test: production data showed the cheap model tagging a grant with
    // all 14 themes while its own `minamata_fit_reason` said it was unrelated to Minamata.
    const raw = {
      ...BASE_FIELDS,
      matched_industries: [],
      matched_themes: [
        "population_childcare",
        "gaika_business",
        "exchange_population",
        "healthcare_workforce",
        "disaster_resilience",
        "environment_gx",
        "migration_settlement",
      ],
      uniqueness_tags: [],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("should reject an implausibly large matched_industries list", () => {
    const raw = {
      ...BASE_FIELDS,
      matched_industries: [
        "medical_welfare",
        "manufacturing",
        "wholesale_retail",
        "construction",
        "tourism_sports",
      ],
      matched_themes: [],
      uniqueness_tags: [],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("should reject an implausibly large uniqueness_tags list", () => {
    const raw = {
      ...BASE_FIELDS,
      matched_industries: [],
      matched_themes: [],
      uniqueness_tags: [
        "MINAMATA_DISEASE_AREA",
        "MOYAI",
        "MINAMATA_ASHIKITA_PLAN",
        "ENV_MODEL_CITY",
      ],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("should accept a normal, plausible classification", () => {
    const raw = {
      ...BASE_FIELDS,
      matched_industries: ["medical_welfare"],
      matched_themes: ["population_childcare"],
      uniqueness_tags: [],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });
});

describe("analysisSchema", () => {
  it("should classify into industries/themes and compute rank A deterministically", () => {
    const raw = {
      summary_short: "【対象】市内認定こども園 【使途】施設整備・ICT化 【補助】上限800万円 【アクション】市こども子育て課へ申請",
      support_type: "交付金",
      target_entities: "認定こども園（民間法人）",
      max_amount: "800万円",
      subsidy_rate: "定額",
      eligible_themes: "子育て,施設整備",
      required_documents: "申請書,事業計画書",
      notes: null,
      ai_confidence: 90,
      matched_industries: ["medical_welfare"],
      matched_themes: ["population_childcare"],
      uniqueness_tags: [],
      generic_migration: false,
      not_eligible_for_minamata: false,
      recruitment_effectively_closed: false,
      minamata_fit_reason: "市内認定こども園は全16園が民間運営で、子育て支援の最重点施策に直結する",
      suggested_department: "こども子育て課",
      suggested_department_reason: "子育て支援施策の担当課のため",
      minamata_use_case: "認定こども園の施設整備・ICT化支援",
      minamata_categories: ["福祉・医療"],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.minamata_fit_rank).toBe("A");
      expect(parsed.data.minamata_fit_score).toBe(77.3);
    }
  });

  it("should compute rank B for a mid-scoring classification", () => {
    const raw = {
      summary_short: "【対象】市内介護事業者 【使途】ICT導入による人材確保 【補助】上限200万円 【アクション】県窓口へ申請",
      support_type: "補助金",
      target_entities: "介護事業者",
      max_amount: "200万円",
      subsidy_rate: "1/2",
      eligible_themes: "介護,DX",
      required_documents: null,
      notes: null,
      ai_confidence: 80,
      matched_industries: ["medical_welfare"],
      matched_themes: ["healthcare_workforce"],
      uniqueness_tags: [],
      generic_migration: false,
      not_eligible_for_minamata: false,
      recruitment_effectively_closed: false,
      minamata_fit_reason: "介護求人倍率が高い水俣市の人材確保課題に合致",
      suggested_department: "いきいき健康課",
      suggested_department_reason: "介護人材確保の担当課のため",
      minamata_use_case: "介護施設でのICT導入による省力化",
      minamata_categories: ["福祉・医療"],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.minamata_fit_rank).toBe("B");
      expect(parsed.data.minamata_fit_score).toBe(73.8);
    }
  });

  it("should cap the score and force rank C when not eligible for Minamata applicants", () => {
    const raw = {
      summary_short: "【対象】大企業 【使途】半導体工場新設 【補助】上限10億円 【アクション】公募",
      support_type: "補助金",
      target_entities: "大企業（資本金10億円以上）",
      max_amount: "10億円",
      subsidy_rate: "1/3",
      eligible_themes: "先端技術,外貨獲得",
      required_documents: null,
      notes: "大企業限定のため水俣市内事業者は応募不可",
      ai_confidence: 95,
      matched_industries: ["manufacturing"],
      matched_themes: ["gaika_business"],
      uniqueness_tags: [],
      generic_migration: false,
      not_eligible_for_minamata: true,
      recruitment_effectively_closed: false,
      minamata_fit_reason: "産業テーマは合致するが資本金要件で水俣市内事業者は対象外",
      suggested_department: "経済観光戦略課",
      suggested_department_reason: "産業担当",
      minamata_use_case: "該当なし",
      minamata_categories: [],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.minamata_fit_rank).toBe("C");
      expect(parsed.data.minamata_fit_score).toBe(10);
      expect(parsed.data.score_breakdown.notEligibleCapApplied).toBe(true);
    }
  });
});

describe("analyzeGrant with Workers AI", () => {
  it("should call Workers AI binding, classify, and compute the score deterministically", async () => {
    const mockJson = {
      summary_short: "【対象】胎児性・小児性水俣病患者等 【使途】地域生活支援 【補助】定額 【アクション】県・団体経由で申請",
      support_type: "補助金",
      target_entities: "胎児性・小児性水俣病患者等",
      max_amount: null,
      subsidy_rate: "定額",
      eligible_themes: "水俣病対策,地域共生",
      required_documents: null,
      notes: null,
      ai_confidence: 85,
      matched_industries: ["medical_welfare"],
      matched_themes: ["community_kyosei"],
      uniqueness_tags: ["MINAMATA_DISEASE_AREA", "MOYAI"],
      generic_migration: false,
      not_eligible_for_minamata: false,
      recruitment_effectively_closed: false,
      minamata_fit_reason: "水俣病発生地域限定制度に該当し、地域共生テーマとも合致",
      suggested_department: "福祉課",
      suggested_department_reason: "水俣病対策・福祉の担当課のため",
      minamata_use_case: "地域生活支援員の配置拡充",
      minamata_categories: ["福祉・医療"],
    };

    const mockAi: WorkersAiBinding = {
      run: vi.fn().mockResolvedValue({
        response: JSON.stringify(mockJson),
      }),
    };

    const env: Partial<Env> = {
      AI: mockAi,
    };

    const result = await analyzeGrant(
      {
        title: "胎児性・小児性水俣病患者等 地域生活支援事業",
        source_ministry: "熊本県",
        source_url: "https://example.com/grant/1",
        deadline: "2026-10-31",
        raw_text: "胎児性・小児性水俣病患者等の地域生活を支援する事業...",
      },
      env
    );

    expect(mockAi.run).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.minamata_fit_rank).toBe("A");
    expect(result?.minamata_fit_score).toBe(78.3);
    expect(result?.summary_short).toContain("【対象】");
  });
});
