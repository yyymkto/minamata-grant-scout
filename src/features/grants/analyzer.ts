/**
 * AI Analyzer — Cloudflare Workers AI を使って補助金を解析する。
 * LLMは産業・政策テーマ・水俣固有性タグへの分類のみを行い、0〜100点のスコアと
 * A/B/Cランクは minamata-scoring-profile.ts の決定論的なロジックで計算する
 * （LLM分類 + 決定論的スコア計算のハイブリッド方式）。
 */
import { MINAMATA_PROFILE } from "./minamata-profile";
import { parseJsonFromText } from "./json-parser";
import { logEvent } from "../../lib/logging";
import { z } from "zod";
import type { Env, WorkersAiBinding } from "../../types";
import {
  INDUSTRIES,
  THEMES,
  UNIQUENESS_TAGS,
  scoreSubsidy,
  type ScoreBreakdown,
} from "./minamata-scoring-profile";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RAW_TEXT_LENGTH = 8_000;

/**
 * LLMは「産業・テーマ・固有性タグへの分類」のみを行い、最終スコア（0〜100）とランクは
 * minamata-scoring-profile.ts の決定論的なロジックで計算する。LLMに暗算させない。
 * 未知のキー（ハルシネーション）は scoreSubsidy 側で無視されるため、ここでは緩く受ける。
 */
const flexibleBoolean = z.preprocess((v) => {
  if (typeof v === "string") return v.toLowerCase() === "true";
  return v;
}, z.boolean());

export const analysisSchema = z.object({
  summary_short: z.string().default(""),
  support_type: z.string().default("その他"),
  target_entities: z.string().default(""),
  max_amount: z.string().nullable().default(null),
  subsidy_rate: z.string().nullable().default(null),
  eligible_themes: z.string().default(""),
  required_documents: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  ai_confidence: z.coerce.number().int().min(0).max(100).default(50),
  minamata_fit_reason: z.string().default(""),
  suggested_department: z.string().default(""),
  suggested_department_reason: z.string().default(""),
  minamata_use_case: z.string().default(""),
  minamata_categories: z.union([z.array(z.string()), z.string()]).default([]),
  matched_industries: z.array(z.string()).default([]),
  matched_themes: z.array(z.string()).default([]),
  uniqueness_tags: z.array(z.string()).default([]),
  generic_migration: flexibleBoolean.default(false),
  recruitment_effectively_closed: flexibleBoolean.default(false),
  not_eligible_for_minamata: flexibleBoolean.default(false),
}).superRefine((data, ctx) => {
  /**
   * 安全弁: 実データ検証で「関係ない」と理由説明しながらテーマを機械的に
   * 全列挙する等の分類崩壊が確認された。不自然に多い分類は失敗とみなし、
   * safeParseを失敗させて次のモデル・プロバイダにフォールバックさせる
   * （個々の補助金が本当に5テーマ以上に跨ることは稀なため、閾値は余裕を持たせている）。
   */
  if (data.matched_themes.length > 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matched_themes"],
      message: `matched_themes has ${data.matched_themes.length} entries — looks like the model echoed the theme list instead of classifying`,
    });
  }
  if (data.matched_industries.length > 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matched_industries"],
      message: `matched_industries has ${data.matched_industries.length} entries — looks like a classification failure`,
    });
  }
  if (data.uniqueness_tags.length > 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["uniqueness_tags"],
      message: `uniqueness_tags has ${data.uniqueness_tags.length} entries — uniqueness tags should be rare`,
    });
  }
}).transform((data) => {
  const scored = scoreSubsidy({
    industries: data.matched_industries,
    themes: data.matched_themes,
    uniquenessTags: data.uniqueness_tags,
    genericMigration: data.generic_migration,
    recruitmentEffectivelyClosed: data.recruitment_effectively_closed,
    notEligibleForMinamata: data.not_eligible_for_minamata,
  });

  return {
    ...data,
    minamata_fit_score: scored.score,
    minamata_fit_rank: scored.rank,
    score_breakdown: scored.breakdown as ScoreBreakdown,
    score_notes: scored.notes,
  };
});

/**
 * SYSTEM_PROMPT に埋め込む一覧テキストは minamata-scoring-profile.ts のデータから
 * 都度生成する（プロンプトと配点ロジックの定義が二重管理でズレるのを防ぐため）。
 */
function renderIndustriesForPrompt(): string {
  return Object.entries(INDUSTRIES)
    .map(([key, def]) => `- ${key}（${def.label}）: ${def.rationale}`)
    .join("\n");
}

function renderThemesForPrompt(): string {
  return Object.entries(THEMES)
    .map(([key, def]) => `- ${key}（${def.label}）: ${def.basis}`)
    .join("\n");
}

function renderUniquenessTagsForPrompt(): string {
  return Object.entries(UNIQUENESS_TAGS)
    .map(([key, def]) => {
      const examples = def.examples ? `\n  例: ${def.examples.join(" / ")}` : "";
      const doNotApply = def.doNotApplyTo
        ? `\n  ※付けない対象: ${def.doNotApplyTo.join("、")}`
        : "";
      return `- ${key}（${def.label}、加点${def.bonus}点）: ${def.appliesWhen}${examples}${doNotApply}`;
    })
    .join("\n");
}

export const SYSTEM_PROMPT = `あなたは熊本県水俣市（みなまたし）専属の補助金アナリストです。
与えられた補助金・公募情報を厳密に精査し、下記の基準に従って「該当する産業」「該当する政策テーマ」「水俣固有性タグ」への分類と、いくつかの判定フラグの設定を行い、指定されたJSON形式で結果を返してください。
必ず有効なJSONのみを出力してください。

**重要**: 0〜100点のスコアやA/B/Cのランクはあなた自身が計算する必要はありません。以下の分類結果から自動的に計算されるので、あなたの役割は分類の正確性のみです。スコアやランクをJSONに含める必要はありません。

**キー形式の厳守（重要）**: matched_industries・matched_themes・uniqueness_tagsには、以下の分類1〜3にリストされた英数字・アンダースコアのキー（例: medical_welfare, population_childcare, MOYAI）をそのまま1文字も変えずに使ってください。日本語のラベル（例: "福祉・医療"）を書く、リストに無いキーを新しく作る、キーの一部だけ書く、といったことは禁止です。該当するものが1つも無ければ、無理に何か選ばず空配列のままにしてください。判断に迷う場合は「選ばない」を選んでください（多く選びすぎるより、選ばれなさすぎる方が安全です）。

${MINAMATA_PROFILE}

## 分類1: 該当する産業（matched_industries、複数選択可、無ければ空配列。目安は0〜2個）
補助金が対象とする産業が、水俣市の以下のどの産業に該当するか選んでください（該当が無ければ空配列）。
${renderIndustriesForPrompt()}

## 分類2: 該当する政策テーマ（matched_themes、複数選択可、無ければ空配列。目安は0〜2個）
産業分類を持たない補助金（移住支援金、DX推進事業など）や、複数産業を横断する政策テーマに該当する場合はこちらで拾ってください。産業と重複して選んでも構いません。この補助金の主目的に直接該当するテーマだけを選び、間接的に関連しそうというだけで手当たり次第に選ばないでください。
${renderThemesForPrompt()}

## 分類3: 水俣固有性タグ（uniqueness_tags、複数選択可、無ければ空配列。目安は0〜1個）
「他の自治体では代替の効かない、水俣市だからこそ該当する」制度的・歴史的資産に合致する場合のみ選んでください。汎用的な補助金には付けないでください。特にMINAMATA_DISEASE_AREAは、本文中に水俣病発生地域・水俣病患者への限定が明記されている場合のみ選び、単に熊本県内の施設・自治体が対象というだけの一般的な補助金（震災復旧、処遇改善等）には付けないでください。
${renderUniquenessTagsForPrompt()}

## 判定フラグ
- generic_migration（真偽値）: 移住支援金・住宅取得補助・空き家バンクなど、水俣病の教訓や地域固有の文脈と関係なく全国どこでも成立する汎用的な移住・定住施策なら true。この場合、MOYAIタグを選んでいても加点されません（水俣病を移住プロモーションに利用していると受け取られるリスクを避けるガードレールです）
- not_eligible_for_minamata（真偽値）: 大企業限定、三大都市圏限定、指定対象外地域など、水俣市役所・市内事業者・市民がそもそも応募主体になれない場合 true
- recruitment_effectively_closed（真偽値）: 下記「募集終了・事後手続きページの判定」に該当する場合 true

## 募集終了・事後手続きページの判定（重要）
補助金・公募情報のツール側の締切情報（下記ユーザーメッセージの「締切」欄）は、データ取得元APIの登録上の値であり、実態とズレていることがある。以下のいずれかに該当する場合、ツール側の締切がどれだけ先の日付であっても鵜呑みにせず、「新規の申請は実質的に終了している」と判断し、recruitment_effectively_closedをtrueにすること。

- 本文（原文）中に、新規申請の受付終了日として具体的な日付が明記されており、その日付が「本日の日付」（ユーザーメッセージ参照）より前である
- タイトルや本文が「交付申請」「交付申請等」「実績報告」「精算払」「採択辞退」など、**すでに採択された事業者向けの事後手続き専用ページ**であることを示している（新規公募ではない）

該当する場合は必ず以下も行う：
- notesに「本文記載の実際の新規申請受付終了日（YYYY-MM-DD）は本日時点で終了済み。新規募集ではなく事後手続き専用ページの可能性が高い」等、判断根拠を具体的に明記する
- summary_shortの【アクション】は「締切までに提出」のような誤解を招く表現を避け、「新規募集は終了している可能性が高いため、水俣市の担当課で最新の公募状況を確認」のように慎重な表現にする

## AI要約フォーマット（summary_short）
事業者が5秒で応募可否を判断できるよう、以下の4要素を含めた簡潔で具体的な構造化サマリー（120〜180文字程度）を作成してください:
「【対象】... 【使途】... 【補助】... 【アクション】...」
例: 「【対象】水俣市の柑橘・茶農家 【使途】農業用ハウスの省エネ機器・スマート農業設備導入 【補助】上限500万円（補助率2/3） 【アクション】締切までに市農林水産課またはJAを通じて申請書を提出」

## 水俣市活用仮説（minamata_use_case）
単なる一般論ではなく、水俣市の具体的資源（不知火海、湯の児・湯の鶴温泉、エコタウン、甘夏・水俣茶の産地、環境モデル都市としての実績等）や課題（人口減少・高齢化、農林業の担い手不足、水俣病対策としての恒久的な医療福祉ニーズ等）を踏まえた具体的な活用アイデアを2〜3文で記載してください。

## 出力形式（JSON）
必ず以下のキーを持つJSONオブジェクトのみを返してください。スコア・ランクは含めないでください（自動計算されます）。

{
  "summary_short": "【対象】... 【使途】... 【補助】... 【アクション】...",
  "support_type": "補助金 | 交付金 | 委託事業 | 実証事業 | その他",
  "target_entities": "対象者（自治体、農業法人、小規模事業者等）",
  "max_amount": "補助額上限（例: 1,000万円）。不明なら null",
  "subsidy_rate": "補助率（例: 2/3）。不明なら null",
  "eligible_themes": "対象テーマ（カンマ区切り）",
  "required_documents": "主な必要書類（簡潔に）。不明なら null",
  "notes": "その他注意点。なければ null",
  "ai_confidence": 0〜100の整数,
  "matched_industries": ["該当する産業キーの配列（0個以上、上記「分類1」のキーのみ使用）"],
  "matched_themes": ["該当する政策テーマキーの配列（0個以上、上記「分類2」のキーのみ使用）"],
  "uniqueness_tags": ["該当する固有性タグキーの配列（0個以上、上記「分類3」のキーのみ使用）"],
  "generic_migration": true または false,
  "not_eligible_for_minamata": true または false,
  "recruitment_effectively_closed": true または false,
  "minamata_fit_reason": "上記の分類に至った根拠の解説（2〜3文）",
  "suggested_department": "水俣市役所で主担当になりそうな課",
  "suggested_department_reason": "その課を推定した理由（1〜2文）",
  "minamata_use_case": "水俣市での具体的な活用仮説（2〜3文）",
  "minamata_categories": ["該当するカテゴリをすべて選択"]
}

## minamata_categories の選択肢（複数選択可。UI表示・絞り込み用のタグで、上記の産業・テーマ分類とは別に選択する）
- 農業: 柑橘（甘夏・デコポン）・水俣茶・サラダたまねぎ・環境保全型農業など農業全般
- 漁業: 不知火海の漁業・水産加工など漁業全般
- 林業: 森林整備・木材利用など
- 旅館・観光: 湯の児・湯の鶴温泉・観光振興・地域資源活用・環境学習ツアーなど
- 小規模事業者: 小規模事業者・商店街・事業承継・創業支援など
- インフラ・建設: 道路・港湾・上下水道・防災・建設業など
- 福祉・医療: 高齢者・障害者・子育て・医療・介護・水俣病対策など
- 教育・文化: 学校・生涯学習・文化財・スポーツなど
- デジタル・IT: DX・情報通信・マイナンバー・テレワークなど
- 環境・エネルギー: 脱炭素・再エネ・省エネ・廃棄物・資源循環・エコタウン・環境教育など
- 地域振興: 移住定住・関係人口・地域おこし・もやい直し・コミュニティ再生など

## suggested_department の候補
総務課, 地域振興課, 財政課, 税務課, 危機管理防災課, 市民課, 環境課, いきいき健康課, 福祉課, こども子育て課, 経済観光戦略課, 農林水産課, 土木課, 都市計画課, 教育課
`;

export interface GrantForAnalysis {
  title: string;
  source_ministry: string;
  source_url: string;
  deadline: string | null;
  raw_text: string | null;
}

export interface AnalysisResult {
  summary_short: string;
  support_type: string;
  target_entities: string;
  max_amount: string | null;
  subsidy_rate: string | null;
  eligible_themes: string;
  required_documents: string | null;
  notes: string | null;
  ai_confidence: number;
  matched_industries: string[];
  matched_themes: string[];
  uniqueness_tags: string[];
  generic_migration: boolean;
  not_eligible_for_minamata: boolean;
  recruitment_effectively_closed: boolean;
  /** minamata-scoring-profile.ts のロジックで自動計算される（LLMは出力しない） */
  minamata_fit_rank: string;
  minamata_fit_score: number;
  score_breakdown: ScoreBreakdown;
  score_notes: string[];
  minamata_fit_reason: string;
  suggested_department: string;
  suggested_department_reason: string;
  minamata_use_case: string;
  minamata_categories: string[] | string;
}

/**
 * Workers AI models to try in order（Workers AI無料枠は1日10,000ニューロン）。
 * 参考ニューロン単価（入力/出力 per M tokens、developers.cloudflare.com/workers-ai/platform/pricing/）:
 *   qwen3-30b-a3b-fp8 (MoE, active 3B):  4,625 / 30,475
 *   llama-3.1-8b-instruct-fp8-fast:      4,119 / 34,868
 *   llama-3.3-70b-instruct-fp8-fast:    26,668 / 204,805（安全網。滅多に到達しない想定）
 * qwen3.8-27bは同クラス最高コスト（40,909 / 290,909）のため除外。
 *
 * 産業・政策テーマ・固有性タグへの多項目分類＋理由説明を同時に整合させて出力する必要が
 * あるため、コストがほぼ同等のqwen3-30b-a3b-fp8（MoEで実質3Bだが総パラメータ30B）を
 * 最優先にしている。llama-3.1-8b-instruct-fp8-fastは本番データの検証で「関係ない」と
 * 理由説明しながら全テーマを機械的に列挙する等の分類崩壊が確認されたため、
 * 2番手の安価なフォールバックに格下げした（2026-09の実データ検証結果）。
 */
const WORKERS_AI_MODELS = [
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
] as const;

/** Call Cloudflare Workers AI native binding */
async function callWorkersAi(
  ai: WorkersAiBinding,
  model: string,
  systemPrompt: string,
  userMessage: string,
  grantTitle: string
): Promise<AnalysisResult | null> {
  const MAX_RETRIES = 1;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await ai.run<Record<string, unknown>>(model, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2048,
        response_format: { type: "json_object" },
      });

      let rawText = "";
      if (typeof res === "string") {
        rawText = res;
      } else if (res && typeof res === "object") {
        if ("response" in res) {
          const raw = res.response;
          rawText = typeof raw === "string" ? raw : raw != null ? JSON.stringify(raw) : "";
        } else {
          rawText = JSON.stringify(res);
        }
      }

      const parsed = parseJsonFromText(rawText);
      if (!parsed) {
        logEvent("warn", "analyzer.workers_ai.no_json", { model, title: grantTitle });
        return null;
      }

      const validated = analysisSchema.safeParse(parsed);
      if (!validated.success) {
        logEvent("warn", "analyzer.workers_ai.validation_failed", {
          model,
          title: grantTitle,
          errors: validated.error.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
        });
        return null;
      }

      return validated.data as AnalysisResult;
    } catch (err) {
      logEvent("warn", "analyzer.workers_ai.error", {
        model,
        title: grantTitle,
        attempt,
        message: err instanceof Error ? err.message : String(err),
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }

  return null;
}

/** Fallback HTTP LLM (OpenAI / Moonshot) */
async function callHttpLlm(
  provider: { baseUrl: string; apiKey: string; model: string; thinkingParam?: Record<string, unknown> },
  systemPrompt: string,
  userMessage: string,
  grantTitle: string
): Promise<AnalysisResult | null> {
  const MAX_RETRIES = 1;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model: provider.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      };
      if (provider.thinkingParam) {
        body.thinking = provider.thinkingParam;
      }

      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        const err = await res.text();
        logEvent("error", "analyzer.http_error", {
          provider: provider.model,
          status: res.status,
          body: err.substring(0, 200),
          title: grantTitle,
        });
        return null;
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string; reasoning_content?: string } }[];
      };
      const message = data.choices?.[0]?.message;

      let text = message?.content || "";
      if (!text.trim() && message?.reasoning_content) {
        text = message.reasoning_content;
      }

      const parsed = parseJsonFromText(text);
      if (!parsed) {
        logEvent("warn", "analyzer.http.no_json", { provider: provider.model, title: grantTitle });
        return null;
      }

      const validated = analysisSchema.safeParse(parsed);
      if (!validated.success) {
        logEvent("warn", "analyzer.http.validation_failed", {
          provider: provider.model,
          title: grantTitle,
          errors: validated.error.issues.map((i) => `${i.path}: ${i.message}`).join("; "),
        });
        return null;
      }

      return validated.data as AnalysisResult;
    } catch (err) {
      logEvent("error", "analyzer.http.exception", {
        provider: provider.model,
        title: grantTitle,
        attempt,
        message: err instanceof Error ? err.message : String(err),
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }

  return null;
}

export async function analyzeGrant(
  grant: GrantForAnalysis,
  env: Partial<Env>
): Promise<AnalysisResult | null> {
  const truncatedText = grant.raw_text
    ? grant.raw_text.length > MAX_RAW_TEXT_LENGTH
      ? `${grant.raw_text.substring(0, MAX_RAW_TEXT_LENGTH)}\n...（以降省略）`
      : grant.raw_text
    : null;

  const userMessage = `以下の補助金・公募情報を分析し、結果をJSONで返してください。

## 本日の日付
${new Date().toISOString().slice(0, 10)}

## タイトル
${grant.title}

## 省庁
${grant.source_ministry}

## 締切（データ取得元APIの登録値。本文中の記載と矛盾する場合はSYSTEM_PROMPTの「募集終了・事後手続きページの判定」を優先すること）
${grant.deadline || "不明"}

## URL
${grant.source_url}

## 本文
${truncatedText || "（本文なし — タイトルと省庁から推定してください）"}
`;

  // 1. Primary & Secondary: Cloudflare Workers AI models
  if (env.AI) {
    for (const model of WORKERS_AI_MODELS) {
      logEvent("info", "analyzer.start_workers_ai", { model, title: grant.title });
      const result = await callWorkersAi(env.AI, model, SYSTEM_PROMPT, userMessage, grant.title);
      if (result) {
        logEvent("info", "analyzer.workers_ai.success", { model, title: grant.title, score: result.minamata_fit_score, rank: result.minamata_fit_rank });
        return result;
      }
    }
  }

  // 2. Fallback: Google Gemini (if configured) — AI Studio 無料枠、OpenAI互換エンドポイント経由
  if (env.GEMINI_API_KEY) {
    logEvent("info", "analyzer.fallback_to_gemini", { title: grant.title });
    const result = await callHttpLlm(
      {
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: env.GEMINI_API_KEY,
        model: "gemini-3.6-flash",
      },
      SYSTEM_PROMPT,
      userMessage,
      grant.title
    );
    if (result) return result;
  }

  // 3. Fallback: OpenAI GPT-4o-mini (if configured)
  if (env.OPENAI_API_KEY) {
    logEvent("info", "analyzer.fallback_to_openai", { title: grant.title });
    const result = await callHttpLlm(
      {
        baseUrl: "https://api.openai.com/v1",
        apiKey: env.OPENAI_API_KEY,
        model: "gpt-4o-mini",
      },
      SYSTEM_PROMPT,
      userMessage,
      grant.title
    );
    if (result) return result;
  }

  // 4. Fallback: Kimi K2.5 (if configured)
  if (env.KIMI_API_KEY) {
    logEvent("info", "analyzer.fallback_to_kimi", { title: grant.title });
    const result = await callHttpLlm(
      {
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: env.KIMI_API_KEY,
        model: "kimi-k2.5",
        thinkingParam: { type: "disabled" },
      },
      SYSTEM_PROMPT,
      userMessage,
      grant.title
    );
    if (result) return result;
  }

  return null;
}

