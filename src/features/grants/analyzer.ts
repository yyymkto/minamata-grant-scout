/**
 * AI Analyzer — Kimi K2.5 APIで補助金情報を解析
 */
import { TARA_PROFILE } from "./tara-profile";
import { parseJsonFromText } from "./json-parser";
import { logEvent } from "../../lib/logging";

const KIMI_BASE_URL = "https://api.moonshot.ai/v1";

const SYSTEM_PROMPT = `あなたは地方自治体向けの補助金アナリストです。
与えられた補助金・公募情報を分析し、指定されたJSON形式で結果を返してください。
必ず有効なJSONのみを出力してください（json）。

${TARA_PROFILE}

## 出力形式（JSON）

必ず以下のキーを持つJSONオブジェクトを返してください。それ以外のテキストは含めないでください。

{
  "summary_short": "2〜3文の要約",
  "support_type": "補助金 | 交付金 | 委託事業 | 実証事業 | その他",
  "target_entities": "対象者（自治体、農業法人、NPO等）",
  "max_amount": "補助額上限（例: 1,000万円）。不明なら null",
  "subsidy_rate": "補助率（例: 1/2、2/3）。不明なら null",
  "eligible_themes": "対象テーマ（カンマ区切り）",
  "required_documents": "主な必要書類（簡潔に）。不明なら null",
  "notes": "その他注意点。なければ null",
  "ai_confidence": 0〜100の整数。情報の確度,
  "tara_fit_rank": "A | B | C",
  "tara_fit_score": 0〜100の整数,
  "tara_fit_reason": "太良町との相性の理由（2〜3文）",
  "suggested_department": "太良町で主担当になりそうな課",
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

## 判定基準

### tara_fit_rank
- A: 太良町の課題・産業に直接合致。応募を検討すべき
- B: 間接的に活用できる可能性がある。情報共有推奨
- C: 太良町との関連は薄い。参考程度

### suggested_department の候補
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

export async function analyzeGrant(
  grant: GrantForAnalysis,
  apiKey: string
): Promise<AnalysisResult | null> {
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
${grant.raw_text || "（本文なし — タイトルと省庁から推定してください）"}
`;

  try {
    const res = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "kimi-k2.5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        thinking: { type: "disabled" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logEvent("error", "analyzer.api_error", {
        status: res.status,
        body: err.substring(0, 200),
        title: grant.title,
      });
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
    };
    const message = data.choices?.[0]?.message;

    let text = message?.content || "";
    if (!text.trim() && message?.reasoning_content) {
      logEvent("info", "analyzer.reasoning_fallback", { title: grant.title });
      text = message.reasoning_content;
    }

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      logEvent("warn", "analyzer.no_json", { title: grant.title });
      return null;
    }

    return parsed as unknown as AnalysisResult;
  } catch (err) {
    logEvent("error", "analyzer.exception", {
      title: grant.title,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
