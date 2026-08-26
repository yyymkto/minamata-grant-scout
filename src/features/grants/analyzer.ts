/**
 * AI Analyzer — Cloudflare Workers AI を使って補助金を4軸ルーブリック評価・解析
 */
import { TARA_PROFILE } from "./tara-profile";
import { parseJsonFromText } from "./json-parser";
import { logEvent } from "../../lib/logging";
import { z } from "zod";
import type { Env, WorkersAiBinding } from "../../types";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RAW_TEXT_LENGTH = 8_000;

const VALID_RANKS = ["A", "B", "C"] as const;

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
  tara_fit_score: z.coerce.number().int().min(0).max(100).default(0),
  tara_fit_rank: z.string().transform((v) =>
    VALID_RANKS.includes(v as (typeof VALID_RANKS)[number]) ? v : "C"
  ),
  tara_fit_reason: z.string().default(""),
  suggested_department: z.string().default(""),
  suggested_department_reason: z.string().default(""),
  tara_use_case: z.string().default(""),
  tara_categories: z.union([z.array(z.string()), z.string()]).default([]),
}).transform((data) => {
  // スコアとランクの整合性を担保
  let rank = data.tara_fit_rank;
  if (data.tara_fit_score >= 75) {
    rank = "A";
  } else if (data.tara_fit_score >= 50) {
    rank = "B";
  } else {
    rank = "C";
  }
  return {
    ...data,
    tara_fit_rank: rank,
  };
});

export const SYSTEM_PROMPT = `あなたは佐賀県太良町（たらちょう）専属の補助金アナリストです。
与えられた補助金・公募情報を厳密に精査し、太良町役場および町内事業者（農家・漁師・温泉旅館・商工業者）にとっての活用価値を評価し、指定されたJSON形式で結果を返してください。
必ず有効なJSONのみを出力してください。

${TARA_PROFILE}

## 評価基準: 4軸ルーブリック採点法（合計 0〜100点）
以下の4つの観点ごとに客観的に採点し、合計点を tara_fit_score（0〜100）として算定してください。

1. 【申請主体・適格性】（0〜25点）
   - 太良町のプレイヤー（町役場、町内みかん・花卉・イチゴ・畜産農家、竹崎カキ・ノリ養殖等の漁師、たら竹崎温泉旅館、町内小規模商工業）が応募対象に含まれるか？
   - 25点: 太良町の対象者が直接の単独申請主体として明記されている
   - 15点: 中小企業・小規模事業者枠や地方自治体枠で広く申請可能
   - 5点: 共同申請や間接的（JA・商工会・県経由等）なら申請可能
   - 0点: 大企業限定、三大都市圏限定、指定対象外地域など太良町から応募不可

2. 【太良町基幹産業・重点課題合致度】（0〜35点）
   - 太良町の主要産業・過疎地域計画の重要課題に合致しているか？
   - 30〜35点: 太良町の特産品・基幹産業（みかん/花卉/畜産、カキ/ノリ、多良岳林業、たら竹崎温泉、過疎・防災・下水道）にドンピシャで合致
   - 20〜29点: 町内事業者の一般的な設備投資、省エネ、DX、事業承継、人手不足対策に合致
   - 10〜19点: 汎用的な補助金（太良町でも使えなくはないが特段の適合性はない）
   - 0〜9点: 太良町の実態・産業構造とほとんど関連がない

3. 【補助規模・実効性】（0〜20点）
   - 補助率や補助上限が、小規模自治体や町内中小零細事業者にとって実用的か？
   - 16〜20点: 補助率が高い（2/3、3/4以上）または定額交付。小規模事業者でも自己負担が少なく使いやすい
   - 10〜15点: 補助率1/2程度、または標準的な補助金
   - 0〜9点: 自己負担比率が高すぎる、または億単位の大規模投資が必須で町内事業者には過大

4. 【申請・執行の実現性】（0〜20点）
   - 申請手続きの難易度や、採択・執行の現実性があるか？
   - 16〜20点: 申請要件が簡潔で小規模事業者・役場担当課でも無理なく対応可能
   - 10〜15点: 通常の申請書類（事業計画書等）で対応可能
   - 0〜9点: 産学官連携の複雑なコンソーシアム必須、高度な研究開発要件などハードルが極めて高い

## ランク判定（tara_fit_rank）
- A (75〜100点): 太良町・町民が直ちに応募・周知を検討すべき有望補助金
- B (50〜74点): 条件付き・間接的に活用余地がある補助金
- C (0〜49点): 太良町との関連性が薄い、または申請が現実的でない補助金

## AI要約フォーマット（summary_short）
事業者が5秒で応募可否を判断できるよう、以下の4要素を含めた簡潔で具体的な構造化サマリー（120〜180文字程度）を作成してください:
「【対象】... 【使途】... 【補助】... 【アクション】...」
例: 「【対象】太良町のみかん・施設園芸農家 【使途】農業用ハウスの省エネ機器・スマート農業設備導入 【補助】上限500万円（補助率2/3） 【アクション】締切までに町農林水産課またはJAを通じて申請書を提出」

## 太良町活用仮説（tara_use_case）
単なる一般論ではなく、太良町の具体的資源（多良岳、有明海、竹崎カキ、たら竹崎温泉、みかん園の斜面等）や課題（高齢化40%、下水道普及率低、タクシー廃業等の交通課題）を踏まえた具体的な活用アイデアを2〜3文で記載してください。

## 出力形式（JSON）
必ず以下のキーを持つJSONオブジェクトのみを返してください。

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
  "tara_fit_score": 0〜100の整数,
  "tara_fit_rank": "A | B | C",
  "tara_fit_reason": "4軸評価に基づく適合理由の解説（2〜3文）",
  "suggested_department": "太良町役場で主担当になりそうな課",
  "suggested_department_reason": "その課を推定した理由（1〜2文）",
  "tara_use_case": "太良町での具体的な活用仮説（2〜3文）",
  "tara_categories": ["該当するカテゴリをすべて選択"]
}

## tara_categories の選択肢（複数選択可）
- 農業: みかん・花卉・イチゴ・畜産・スマート農業など農業全般
- 漁業: ノリ養殖・牡蠣・アサリ・水産加工など漁業全般
- 林業: 森林整備・J-クレジット・木材利用など
- 旅館・観光: 旅館業・観光振興・地域資源活用・インバウンドなど
- 小規模事業者: 小規模事業者・商店街・事業承継・創業支援など
- インフラ・建設: 道路・港湾・上下水道・防災・建設業など
- 福祉・医療: 高齢者・障害者・子育て・医療・介護など
- 教育・文化: 学校・生涯学習・文化財・スポーツなど
- デジタル・IT: DX・情報通信・マイナンバー・テレワークなど
- 環境・エネルギー: 脱炭素・再エネ・省エネ・廃棄物・環境保全など
- 地域振興: 移住定住・関係人口・地域おこし・過疎対策など

## suggested_department の候補
総務課, 企画商工課, 財政課, 町民福祉課, 健康増進課, 環境水道課, 税務課, 農林水産課, 建設課
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
  tara_fit_rank: string;
  tara_fit_score: number;
  tara_fit_reason: string;
  suggested_department: string;
  suggested_department_reason: string;
  tara_use_case: string;
  tara_categories: string[] | string;
}

/** Workers AI models to try in order */
const WORKERS_AI_MODELS = [
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/qwen/qwen2.5-72b-instruct",
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

## タイトル
${grant.title}

## 省庁
${grant.source_ministry}

## 締切
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
        logEvent("info", "analyzer.workers_ai.success", { model, title: grant.title, score: result.tara_fit_score, rank: result.tara_fit_rank });
        return result;
      }
    }
  }

  // 2. Fallback: OpenAI GPT-4o-mini (if configured)
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

  // 3. Fallback: Kimi K2.5 (if configured)
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

