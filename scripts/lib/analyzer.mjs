/**
 * AI Analyzer — Kimi K2.5 APIを使って補助金情報を解析
 *
 * OpenAI互換API（Moonshot AI）
 * - thinking: disabled で Instant Mode（reasoning_contentが空になる問題を回避）
 * - reasoning_contentフォールバック付き（保険）
 */
import { TARA_PROFILE } from "./tara-profile.mjs";

const KIMI_API_KEY = process.env.KIMI_API_KEY;
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
 * ブレース対応のJSON抽出（貪欲正規表現よりも正確）
 */
function extractOutermostJson(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/**
 * テキストからJSONを抽出してパース
 */
function parseJsonFromText(text) {
  if (!text?.trim()) return null;

  // 1. ```json ... ``` ブロック
  const codeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]); } catch {}
  }

  // 2. ブレース対応の最外JSONオブジェクト
  const jsonStr = extractOutermostJson(text);
  if (jsonStr) {
    try { return JSON.parse(jsonStr); } catch {}
  }

  return null;
}

/**
 * 補助金情報をKimi K2.5 APIで解析する
 * @param {object} grant - { title, source_ministry, raw_text, source_url, deadline }
 * @returns {object|null} 解析結果のJSON。失敗時はnull
 */
export async function analyzeGrant(grant) {
  if (!KIMI_API_KEY) {
    console.error("  [error] KIMI_API_KEY not set. Export it or add to .dev.vars");
    return null;
  }

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
        Authorization: `Bearer ${KIMI_API_KEY}`,
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
      console.error(`  [error] Kimi API ${res.status}: ${err.substring(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message;

    // content → reasoning_content のフォールバック
    let text = message?.content || "";
    if (!text.trim() && message?.reasoning_content) {
      console.log(`    [info] reasoning_contentからフォールバック`);
      text = message.reasoning_content;
    }

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      console.error(`  [warn] No valid JSON in response for "${grant.title}"`);
      return null;
    }

    return parsed;
  } catch (err) {
    console.error(`  [error] AI analysis failed for "${grant.title}": ${err.message}`);
    return null;
  }
}
