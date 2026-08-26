import { describe, it, expect, vi } from "vitest";
import { analysisSchema, analyzeGrant } from "../src/features/grants/analyzer";
import type { Env, WorkersAiBinding } from "../src/types";

describe("analysisSchema", () => {
  it("should validate and map rank A when score is >= 75", () => {
    const raw = {
      summary_short: "【対象】農家 【使途】省エネ機器 【補助】上限500万円 【アクション】申請書提出",
      support_type: "補助金",
      target_entities: "町内農家",
      max_amount: "500万円",
      subsidy_rate: "2/3",
      eligible_themes: "農業,省エネ",
      required_documents: "申請書,事業計画書",
      notes: null,
      ai_confidence: 90,
      tara_fit_score: 85,
      tara_fit_rank: "B", // score is 85, should be adjusted to A
      tara_fit_reason: "太良町のみかん農家に直結する支援",
      suggested_department: "農林水産課",
      suggested_department_reason: "農業振興事業のため",
      tara_use_case: "ハウスみかん農家でのヒートポンプ導入",
      tara_categories: ["農業"],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tara_fit_rank).toBe("A");
      expect(parsed.data.tara_fit_score).toBe(85);
    }
  });

  it("should map rank B when score is 50-74", () => {
    const raw = {
      summary_short: "【対象】中小企業 【使途】DX 【補助】上限100万円 【アクション】Web申請",
      support_type: "補助金",
      target_entities: "小規模事業者",
      max_amount: "100万円",
      subsidy_rate: "1/2",
      eligible_themes: "IT",
      required_documents: null,
      notes: null,
      ai_confidence: 80,
      tara_fit_score: 60,
      tara_fit_rank: "A", // score is 60, should be adjusted to B
      tara_fit_reason: "汎用的なIT導入補助",
      suggested_department: "企画商工課",
      suggested_department_reason: "商工振興のため",
      tara_use_case: "町内商店でのPOSレジ導入",
      tara_categories: ["小規模事業者", "デジタル・IT"],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tara_fit_rank).toBe("B");
      expect(parsed.data.tara_fit_score).toBe(60);
    }
  });

  it("should map rank C when score is < 50", () => {
    const raw = {
      summary_short: "【対象】大企業 【使途】半導体工場 【補助】上限10億円 【アクション】公募",
      support_type: "補助金",
      target_entities: "大企業",
      max_amount: "10億円",
      subsidy_rate: "1/3",
      eligible_themes: "先端技術",
      required_documents: null,
      notes: null,
      ai_confidence: 95,
      tara_fit_score: 10,
      tara_fit_rank: "A",
      tara_fit_reason: "太良町には大企業・半導体工場がないため対象外",
      suggested_department: "企画商工課",
      suggested_department_reason: "産業担当",
      tara_use_case: "該当なし",
      tara_categories: [],
    };

    const parsed = analysisSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tara_fit_rank).toBe("C");
      expect(parsed.data.tara_fit_score).toBe(10);
    }
  });
});

describe("analyzeGrant with Workers AI", () => {
  it("should call Workers AI binding and return parsed result", async () => {
    const mockJson = {
      summary_short: "【対象】太良町農家 【使途】スマート農業 【補助】上限300万円 【アクション】JA経由申請",
      support_type: "補助金",
      target_entities: "農家",
      max_amount: "300万円",
      subsidy_rate: "1/2",
      eligible_themes: "農業",
      required_documents: null,
      notes: null,
      ai_confidence: 85,
      tara_fit_score: 80,
      tara_fit_rank: "A",
      tara_fit_reason: "みかん園の傾斜地での作業省力化に合致",
      suggested_department: "農林水産課",
      suggested_department_reason: "農業担当のため",
      tara_use_case: "みかん園での散水自動化",
      tara_categories: ["農業"],
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
        title: "スマート農業導入実証事業",
        source_ministry: "農林水産省",
        source_url: "https://example.com/grant/1",
        deadline: "2026-10-31",
        raw_text: "スマート農業機器の導入支援...",
      },
      env
    );

    expect(mockAi.run).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.tara_fit_rank).toBe("A");
    expect(result?.tara_fit_score).toBe(80);
    expect(result?.summary_short).toContain("【対象】");
  });
});
