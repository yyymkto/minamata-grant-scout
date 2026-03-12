/**
 * AI Analyzer — Claude APIを使って補助金情報を解析
 *
 * 差し替え可能: このファイルのanalyzeGrant()を別のLLMに差し替えればOK
 */
import Anthropic from "@anthropic-ai/sdk";
import { TARA_PROFILE } from "./tara-profile.mjs";

const client = new Anthropic();

const SYSTEM_PROMPT = `あなたは地方自治体向けの補助金アナリストです。
与えられた補助金・公募情報を分析し、指定されたJSON形式で結果を返してください。

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
  "tara_use_case": "太良町での具体的な活用仮説（2〜3文）"
}

## 判定基準

### tara_fit_rank
- A: 太良町の課題・産業に直接合致。応募を検討すべき
- B: 間接的に活用できる可能性がある。情報共有推奨
- C: 太良町との関連は薄い。参考程度

### suggested_department の候補
総務課, 企画商工課, 財政課, 町民福祉課, 健康増進課, 環境水道課, 税務課, 農林水産課, 建設課
`;

/**
 * 補助金情報をClaude APIで解析する
 * @param {object} grant - { title, source_ministry, raw_text, source_url, deadline }
 * @returns {object|null} 解析結果のJSON。失敗時はnull
 */
export async function analyzeGrant(grant) {
  const userMessage = `以下の補助金・公募情報を分析してください。

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
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // JSONを抽出（コードブロック内にある場合も対応）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`  [warn] No JSON found in AI response for "${grant.title}"`);
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`  [error] AI analysis failed for "${grant.title}": ${err.message}`);
    return null;
  }
}
