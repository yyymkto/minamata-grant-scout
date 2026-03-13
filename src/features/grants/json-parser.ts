/**
 * LLM出力からJSONを安全に抽出するパーサー
 */

/** ブレース対応の最外JSONオブジェクト抽出 */
function extractOutermostJson(text: string): string | null {
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

/** テキストからJSONを抽出してパース */
export function parseJsonFromText(text: string | null | undefined): Record<string, unknown> | null {
  if (!text?.trim()) return null;

  // 1. ```json ... ``` ブロック
  const codeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]); } catch { /* fall through */ }
  }

  // 2. ブレース対応の最外JSONオブジェクト
  const jsonStr = extractOutermostJson(text);
  if (jsonStr) {
    try { return JSON.parse(jsonStr); } catch { /* fall through */ }
  }

  return null;
}
