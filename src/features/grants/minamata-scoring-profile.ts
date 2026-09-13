/**
 * 水俣市 補助金マッチング — 地域プロファイル & 配点エンジン
 *
 * 出典: minamata_research_files/minamata_profile.yaml（2026-09-11時点の調査結果）を
 * TypeScriptに移植したもの。LLMは産業・テーマ・固有性タグへの「分類」のみを行い、
 * 最終スコアは本ファイルの決定論的なロジックで計算する（LLMに0〜100点の暗算をさせない）。
 *
 * 数値の根拠・出典・確度（confidence）は各エントリの rationale / source を参照。
 * 更新時は minamata_research_files/README_design_memo.md の「更新カレンダー」も参照。
 */

export type IndustryKey =
  | "medical_welfare"
  | "manufacturing"
  | "wholesale_retail"
  | "construction"
  | "tourism_sports"
  | "agriculture"
  | "forestry_wood"
  | "fisheries";

export type ThemeKey =
  | "population_childcare"
  | "gaika_business"
  | "exchange_population"
  | "healthcare_workforce"
  | "disaster_resilience"
  | "environment_gx"
  | "migration_settlement"
  | "relationship_learning"
  | "community_kyosei"
  | "primary_industry"
  | "digital_admin"
  | "school_education"
  | "talent_development"
  | "youth_sports"
  | "culture_heritage";

export type UniquenessTagKey =
  | "MINAMATA_DISEASE_AREA"
  | "MOYAI"
  | "MINAMATA_ASHIKITA_PLAN"
  | "ENV_MODEL_CITY"
  | "SDGS_FUTURE_CITY";

export type TimeLimitedModifierKey = "R8_KUMAMOTO_EARTHQUAKE" | "MINAMATA_70TH";

interface IndustryDef {
  label: string;
  /** 就業者シェア指数（0〜5） */
  E: number;
  /** 付加価値指数（0〜5） */
  V: number;
  /** 政策優先指数（0〜5） */
  P: number;
  rationale: string;
  confidence: "high" | "medium" | "low";
}

interface ThemeDef {
  label: string;
  /** 政策優先指数（0〜5） */
  P: number;
  basis: string;
}

interface UniquenessTagDef {
  label: string;
  bonus: number;
  appliesWhen: string;
  examples?: string[];
  doNotApplyTo?: string[];
  confidence: "high" | "medium" | "low";
}

interface TimeLimitedModifierDef {
  label: string;
  bonus: number;
  appliesToThemes?: ThemeKey[];
  appliesToIndustries?: IndustryKey[];
  /** ISO日付。この日を過ぎると自動失効する */
  validUntil: string;
  note?: string;
}

/** 産業分野。base = (0.4*E + 0.3*V + 0.3*P) * 20 は毎回再計算する（更新漏れ防止） */
export const INDUSTRIES: Record<IndustryKey, IndustryDef> = {
  medical_welfare: {
    label: "医療・福祉",
    E: 5.0,
    V: 5.0,
    P: 4.0,
    rationale:
      "就業者24.8%（全国比約1.8倍）、付加価値1位、域外所得も獲得。介護求人倍率は県で約3倍（2020年国勢調査・環境省地域経済循環分析）",
    confidence: "high",
  },
  manufacturing: {
    label: "製造業",
    E: 3.1,
    V: 4.0,
    P: 5.0,
    rationale: "化学・木材で製造業付加価値の7割。総合計画「外貨を稼ぐ水俣」の中核",
    confidence: "medium",
  },
  wholesale_retail: {
    label: "卸売・小売・商店街",
    E: 2.8,
    V: 2.0,
    P: 3.0,
    rationale: "就業3位だが付加価値は上位3位圏外（Vは仮置き）。商店街活性化は過疎計画に明記",
    confidence: "medium",
  },
  construction: {
    label: "建設業",
    E: 1.5,
    V: 4.0,
    P: 2.0,
    rationale: "第2次産業で付加価値1位。震災復旧で時限的に需要増の可能性あり",
    confidence: "medium",
  },
  tourism_sports: {
    label: "観光・宿泊・飲食・スポーツ",
    E: 0.9,
    V: 1.5,
    P: 5.0,
    rationale: "就業4.3%と小さいが、総合計画の最重要プロジェクト「活力生まれる水俣」の中核。国民保養温泉地(2022)",
    confidence: "medium",
  },
  agriculture: {
    label: "農業",
    E: 1.1,
    V: 1.0,
    P: 3.0,
    rationale: "甘夏・不知火・サラダたまねぎ・水俣茶・和紅茶が基幹作物",
    confidence: "medium",
  },
  forestry_wood: {
    label: "森林・林業・木材利用",
    E: 0.3,
    V: 2.5,
    P: 2.5,
    rationale: "林業経営体は主に4だが、森林が市域の約74%を占め、木材・木製品製造業は製造業付加価値の36%",
    confidence: "medium",
  },
  fisheries: {
    label: "水産業",
    E: 0.1,
    V: 0.5,
    P: 2.5,
    rationale: "漁業就業35人・44経営体(2023)。牡蠣養殖・藻場造成・栽培漁業を継続",
    confidence: "high",
  },
};

/** 政策テーマ。産業分類を持たない補助金（移住支援金など）の適合度をここで評価する */
export const THEMES: Record<ThemeKey, ThemeDef> = {
  population_childcare: {
    label: "人口減少対策・子育て",
    P: 5.0,
    basis:
      "総合計画で「本市最大の課題」と明記。こども家庭センター(2024)。市内認定こども園16施設は全て民間法人運営で、子どものための教育・保育給付負担金11.3億円（2026年度、前年比+12.4%）等の補助金の実際の受け手になる。就学前教育・保育の補助金もここで拾う",
  },
  gaika_business: {
    label: "外貨獲得・地場企業の域外展開・企業誘致",
    P: 5.0,
    basis: "総合計画ビジョン、企業支援センター、臨海部産業団地",
  },
  exchange_population: {
    label: "交流人口（スポーツ・観光・エコパーク）",
    P: 5.0,
    basis: "総合計画ビジョン、スポーツコミッション",
  },
  healthcare_workforce: {
    label: "地域医療・介護人材確保",
    P: 4.5,
    basis: "常勤医不在の診療科、小児・産科の維持、過疎地域持続的発展計画第8章",
  },
  disaster_resilience: {
    label: "防災・災害復旧",
    P: 4.0,
    basis: "2003年豪雨の教訓、令和8年熊本地震（災害救助法適用）",
  },
  environment_gx: {
    label: "環境・脱炭素・資源循環",
    P: 4.0,
    basis: "環境モデル都市第3期計画（2030年50%削減）、エコタウン、ペロブスカイト支援",
  },
  migration_settlement: {
    label: "移住・定住",
    P: 3.5,
    basis: "総合戦略KPI「移住支援策を活用した転入者数」0→120人(2028)。優先度は中程度",
  },
  relationship_learning: {
    label: "関係人口・学び型交流（ワーケーション・環境学習）",
    P: 3.5,
    basis: "水俣ワーケーション、環境アカデミア",
  },
  community_kyosei: {
    label: "地域コミュニティ・地域共生",
    P: 3.0,
    basis: "もやい直しセンター維持（過疎計画）、自治会活動支援",
  },
  primary_industry: {
    label: "農林水産振興",
    P: 3.0,
    basis: "過疎地域持続的発展計画第3章",
  },
  digital_admin: {
    label: "DX・行財政",
    P: 2.5,
    basis: "第7次行財政改革大綱",
  },
  school_education: {
    label: "学校教育・子どもの学び",
    P: 4.0,
    basis:
      "総合計画第2章「教育・文化」の中心施策で基本計画中最多の分量（22%）。学校施設の耐震化・トイレ改修を「急務」と明記、学力向上推進事業、GIGA端末更新、学校給食費完全無償化(2026年4月〜)",
  },
  talent_development: {
    label: "高校・人材育成（水俣高校・グローカル人材・水俣環境アカデミア）",
    P: 3.5,
    basis:
      "教育大綱（2026-2029）の決意の1番目。県立高校再編への危機感から半導体関連学科新設・大学連携等で水俣高校を支援",
  },
  youth_sports: {
    label: "子どものスポーツ育成",
    P: 3.5,
    basis:
      "スポーツ推進課は市長部局所管で組織上の優先度が高い。スポーツキッズサポーター事業、中学部活動の地域移行率100%目標(2026年度)。観光・交流人口文脈のスポーツコミッションとは別枠",
  },
  culture_heritage: {
    label: "文化・文化財・生涯学習",
    P: 2.5,
    basis:
      "文化財保存活用地域計画(2024年12月文化庁認定)。ただし過疎計画で財政制約を市自身が明記し優先度は相対的に低い。水俣病資料館・もやい直し関連は環境課所管でMOYAI/MINAMATA_DISEASE_AREAタグ側の加点対象のため、二重加点を避けるためここには含めない",
  },
};

/** 水俣固有性タグ（加点、上限15点） */
export const UNIQUENESS_TAGS: Record<UniquenessTagKey, UniquenessTagDef> = {
  MINAMATA_DISEASE_AREA: {
    label: "水俣病発生地域限定制度",
    bonus: 15,
    appliesWhen: "補助対象地域・対象者が水俣病発生地域/被害者に限定されている",
    examples: [
      "胎児性・小児性水俣病患者等に係る地域生活支援事業（県・団体向け補助）",
      "環境・福祉モデル地域づくり推進事業（県・市町向け補助）",
      "水俣病総合対策医療事業（個人給付、事業者には間接効果のみ）",
    ],
    confidence: "high",
  },
  MOYAI: {
    label: "もやい直し・水俣病の教訓の継承",
    bonus: 10,
    appliesWhen: "事業内容にコミュニティ修復・慰霊・教訓継承・被害者福祉・学び型交流が含まれる",
    doNotApplyTo: ["移住支援金", "住宅取得補助", "空き家バンク等の汎用移住施策"],
    confidence: "medium",
  },
  MINAMATA_ASHIKITA_PLAN: {
    label: "水俣・芦北地域振興計画（第八次 2026-2030）",
    bonus: 8,
    appliesWhen: "県の同計画に位置づく事業",
    confidence: "high",
  },
  ENV_MODEL_CITY: {
    label: "環境モデル都市（2008選定）",
    bonus: 3,
    appliesWhen: "脱炭素・資源循環系の公募で先進性が評価要素になる",
    confidence: "medium",
  },
  SDGS_FUTURE_CITY: {
    label: "SDGs未来都市（2020選定、第3期計画 2026-2031）",
    bonus: 2,
    appliesWhen: "SDGs関連の先進性が評価要素になる公募",
    confidence: "high",
  },
};

/** 時限加点（期限切れで自動失効、上限10点） */
export const TIME_LIMITED_MODIFIERS: Record<TimeLimitedModifierKey, TimeLimitedModifierDef> = {
  R8_KUMAMOTO_EARTHQUAKE: {
    label: "令和8年熊本地震（2026-07-28、水俣市 震度5強、災害救助法適用）",
    bonus: 10,
    appliesToThemes: ["disaster_resilience"],
    appliesToIndustries: ["construction", "tourism_sports", "wholesale_retail", "manufacturing"],
    validUntil: "2028-03-31",
    note: "仮置き。復旧補助の公募状況で見直す",
  },
  MINAMATA_70TH: {
    label: "水俣病公式確認70年事業（県地域提案事業）",
    bonus: 10,
    validUntil: "2027-03-31",
    note: "募集は2026年3月で終了済み。類似の後継事業の監視用に残す",
  },
};

export const SCORING_MODEL = {
  industryFormula: { wEmployment: 0.4, wValueAdded: 0.3, wPolicy: 0.3, scale: 20 },
  scoreComposition: {
    industryFit: 0.45,
    themeFit: 0.35,
    uniquenessBonusMax: 15,
    timeLimitedModifierMax: 10,
  },
  /** 募集終了・事後手続きページと判定された場合の上限キャップ（Cランク相当に抑える） */
  recruitmentClosedCap: 20,
  /** 大企業限定・三大都市圏限定等で水俣市の対象者がそもそも応募できない場合の上限キャップ */
  notEligibleCap: 10,
} as const;

/** 産業の地域重点度（0〜100）。YAMLの `base` は固定値ではなくここで毎回再計算する */
export function industryBase(key: IndustryKey): number {
  const ind = INDUSTRIES[key];
  const f = SCORING_MODEL.industryFormula;
  return (f.wEmployment * ind.E + f.wValueAdded * ind.V + f.wPolicy * ind.P) * f.scale;
}

export interface ScoreBreakdown {
  industryFit: number | null;
  themeFit: number | null;
  core: number;
  uniquenessBonus: number;
  timeLimitedModifier: number;
  recruitmentClosedCapApplied: boolean;
  notEligibleCapApplied: boolean;
}

export interface ScoreResult {
  score: number;
  rank: "A" | "B" | "C";
  breakdown: ScoreBreakdown;
  notes: string[];
}

export interface ScoreSubsidyInput {
  industries: string[];
  themes: string[];
  uniquenessTags: string[];
  /** 汎用移住施策（移住支援金・住宅取得補助・空き家バンク等）なら true。MOYAI加点を抑止するガードレール */
  genericMigration: boolean;
  /** 募集終了・事後手続き専用ページと判定された場合 true。スコアを大きく抑制する */
  recruitmentEffectivelyClosed: boolean;
  /** 大企業限定・三大都市圏限定等で水俣市の対象者がそもそも応募できない場合 true */
  notEligibleForMinamata: boolean;
  today?: Date;
}

function isKnownIndustry(key: string): key is IndustryKey {
  return key in INDUSTRIES;
}
function isKnownTheme(key: string): key is ThemeKey {
  return key in THEMES;
}
function isKnownUniquenessTag(key: string): key is UniquenessTagKey {
  return key in UNIQUENESS_TAGS;
}

/** minamata_research_files/scoring_reference.py の score_subsidy() のTS移植版 */
export function scoreSubsidy(input: ScoreSubsidyInput): ScoreResult {
  const today = input.today ?? new Date();
  const notes: string[] = [];
  const comp = SCORING_MODEL.scoreComposition;

  // 1) 産業適合: 該当産業のうち最大の base
  const industryScores = input.industries.filter(isKnownIndustry).map((k) => industryBase(k));
  const industryFit = industryScores.length > 0 ? Math.max(...industryScores) : null;

  // 2) テーマ適合: 該当テーマのうち最大の P を 0〜100 に換算
  const themeScores = input.themes.filter(isKnownTheme).map((k) => (THEMES[k].P / 5) * 100);
  const themeFit = themeScores.length > 0 ? Math.max(...themeScores) : null;

  // 片方しか無い場合は、もう片方の重みを寄せる
  let core: number;
  if (industryFit === null && themeFit === null) {
    core = 0;
    notes.push("産業・テーマとも未分類");
  } else if (industryFit === null) {
    core = (comp.industryFit + comp.themeFit) * (themeFit as number);
  } else if (themeFit === null) {
    core = (comp.industryFit + comp.themeFit) * industryFit;
  } else {
    core = comp.industryFit * industryFit + comp.themeFit * themeFit;
  }

  // 3) 固有性加点（上限あり）
  let bonus = 0;
  for (const tag of input.uniquenessTags) {
    if (!isKnownUniquenessTag(tag)) continue;
    const t = UNIQUENESS_TAGS[tag];
    if (tag === "MOYAI" && input.genericMigration) {
      notes.push("MOYAI: 汎用移住施策のため加点しない（guardrail）");
      continue;
    }
    bonus += t.bonus;
  }
  bonus = Math.min(bonus, comp.uniquenessBonusMax);

  // 4) 時限加点（期限切れは自動失効）
  let modifier = 0;
  for (const [key, m] of Object.entries(TIME_LIMITED_MODIFIERS) as [
    TimeLimitedModifierKey,
    TimeLimitedModifierDef,
  ][]) {
    if (today > new Date(`${m.validUntil}T23:59:59`)) continue;

    const hitTheme = input.themes.some((t) => (m.appliesToThemes ?? []).includes(t as ThemeKey));
    const hitTag = input.uniquenessTags.includes(key);
    let hit = hitTheme || hitTag;

    if (hit && m.appliesToIndustries && m.appliesToIndustries.length > 0 && input.industries.length > 0) {
      const inScope = input.industries.some((i) => m.appliesToIndustries!.includes(i as IndustryKey));
      if (!inScope) hit = false;
    }

    if (hit) {
      modifier = Math.max(modifier, m.bonus);
      notes.push(`時限加点 ${key}（〜${m.validUntil}）`);
    }
  }
  modifier = Math.min(modifier, comp.timeLimitedModifierMax);

  let total = Math.min(100, core + bonus + modifier);

  let recruitmentClosedCapApplied = false;
  if (input.recruitmentEffectivelyClosed && total > SCORING_MODEL.recruitmentClosedCap) {
    total = SCORING_MODEL.recruitmentClosedCap;
    recruitmentClosedCapApplied = true;
    notes.push("募集終了・事後手続き専用ページと判定されたためスコアを抑制");
  }

  let notEligibleCapApplied = false;
  if (input.notEligibleForMinamata && total > SCORING_MODEL.notEligibleCap) {
    total = SCORING_MODEL.notEligibleCap;
    notEligibleCapApplied = true;
    notes.push("大企業限定・三大都市圏限定等で水俣市の対象者が応募できないためスコアを抑制");
  }

  const rank: "A" | "B" | "C" = total >= 75 ? "A" : total >= 50 ? "B" : "C";

  return {
    score: Math.round(total * 10) / 10,
    rank,
    breakdown: {
      industryFit: industryFit === null ? null : Math.round(industryFit * 10) / 10,
      themeFit: themeFit === null ? null : Math.round(themeFit * 10) / 10,
      core: Math.round(core * 10) / 10,
      uniquenessBonus: bonus,
      timeLimitedModifier: modifier,
      recruitmentClosedCapApplied,
      notEligibleCapApplied,
    },
    notes,
  };
}
