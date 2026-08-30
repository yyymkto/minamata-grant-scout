/**
 * AI Analyzer — Kimi K2.5 APIを使って補助金情報を解析
 *
 * OpenAI互換API（Moonshot AI）
 * - thinking: disabled で Instant Mode（reasoning_contentが空になる問題を回避）
 * - reasoning_contentフォールバック付き（保険）
 */
import { MINAMATA_PROFILE } from "./minamata-profile.mjs";

const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_BASE_URL = "https://api.moonshot.ai/v1";

const SYSTEM_PROMPT = `あなたは熊本県水俣市（みなまたし）専属の補助金アナリストです。
与えられた補助金・公募情報を厳密に精査し、水俣市役所および市内事業者（農家・漁師・製造業・観光事業者・商工業者）にとっての活用価値を評価し、指定されたJSON形式で結果を返してください。
必ず有効なJSONのみを出力してください。

${MINAMATA_PROFILE}

## 評価基準: 4軸ルーブリック採点法（合計 0〜100点）
以下の4つの観点ごとに客観的に採点し、合計点を minamata_fit_score（0〜100）として算定してください。

1. 【申請主体・適格性】（0〜25点）
   - 水俣市のプレイヤー（市役所、市内の柑橘・茶農家、不知火海の漁業者、JNC等の製造業、湯の児・湯の鶴温泉の宿泊業、エコタウン関連企業、市内小規模商工業）が応募対象に含まれるか？
   - 25点: 水俣市の対象者が直接の単独申請主体として明記されている
   - 15点: 中小企業・小規模事業者枠や地方自治体枠で広く申請可能
   - 5点: 共同申請や間接的（JA・商工会議所・県経由等）なら申請可能
   - 0点: 大企業限定、三大都市圏限定、指定対象外地域など水俣市から応募不可

2. 【水俣市基幹産業・重点課題合致度】（0〜35点）
   - 水俣市の主要産業・重点施策に合致しているか？
   - 30〜35点: 水俣市の特産品・基幹産業（柑橘/水俣茶、不知火海の漁業、エコタウン・リサイクル関連産業、湯の児・湯の鶴温泉）や、環境モデル都市として国内屈指の実績を持つ脱炭素・資源循環・環境教育施策にドンピシャで合致
   - 20〜29点: 市内事業者の一般的な設備投資、省エネ、DX、事業承継、人手不足対策、あるいは高齢化・水俣病対策に伴う医療福祉施策に合致
   - 10〜19点: 汎用的な補助金（水俣市でも使えなくはないが特段の適合性はない）
   - 0〜9点: 水俣市の実態・産業構造とほとんど関連がない

3. 【補助規模・実効性】（0〜20点）
   - 補助率や補助上限が、財政基盤の弱い地方都市や市内中小零細事業者にとって実用的か？
   - 16〜20点: 補助率が高い（2/3、3/4以上）または定額交付。小規模事業者でも自己負担が少なく使いやすい
   - 10〜15点: 補助率1/2程度、または標準的な補助金
   - 0〜9点: 自己負担比率が高すぎる、または億単位の大規模投資が必須で市内事業者には過大

4. 【申請・執行の実現性】（0〜20点）
   - 申請手続きの難易度や、採択・執行の現実性があるか？
   - 16〜20点: 申請要件が簡潔で小規模事業者・市役所担当課でも無理なく対応可能
   - 10〜15点: 通常の申請書類（事業計画書等）で対応可能
   - 0〜9点: 産学官連携の複雑なコンソーシアム必須、高度な研究開発要件などハードルが極めて高い
   - 0〜3点: 下記「募集終了・事後手続きページの判定」に該当し、新規の申請が事実上不可能な場合

## 募集終了・事後手続きページの判定（重要）
補助金・公募情報のツール側の締切情報（下記ユーザーメッセージの「締切」欄）は、データ取得元APIの登録上の値であり、実態とズレていることがある。以下のいずれかに該当する場合、ツール側の締切がどれだけ先の日付であっても鵜呑みにせず、「新規の申請は実質的に終了している」と判断すること。

- 本文（原文）中に、新規申請の受付終了日として具体的な日付が明記されており、その日付が「本日の日付」（ユーザーメッセージ参照）より前である
- タイトルや本文が「交付申請」「交付申請等」「実績報告」「精算払」「採択辞退」など、**すでに採択された事業者向けの事後手続き専用ページ**であることを示している（新規公募ではない）

該当する場合は必ず以下を行う：
- 【申請・執行の実現性】を0〜3点に抑え、minamata_fit_scoreに反映する
- notesに「本文記載の実際の新規申請受付終了日（YYYY-MM-DD）は本日時点で終了済み。新規募集ではなく事後手続き専用ページの可能性が高い」等、判断根拠を具体的に明記する
- summary_shortの【アクション】は「締切までに提出」のような誤解を招く表現を避け、「新規募集は終了している可能性が高いため、水俣市の担当課で最新の公募状況を確認」のように慎重な表現にする

## ランク判定（minamata_fit_rank）
- A (75〜100点): 水俣市・市民が直ちに応募・周知を検討すべき有望補助金
- B (50〜74点): 条件付き・間接的に活用余地がある補助金
- C (0〜49点): 水俣市との関連性が薄い、または申請が現実的でない補助金

## AI要約フォーマット（summary_short）
事業者が5秒で応募可否を判断できるよう、以下の4要素を含めた簡潔で具体的な構造化サマリー（120〜180文字程度）を作成してください:
「【対象】... 【使途】... 【補助】... 【アクション】...」
例: 「【対象】水俣市の柑橘・茶農家 【使途】農業用ハウスの省エネ機器・スマート農業設備導入 【補助】上限500万円（補助率2/3） 【アクション】締切までに市農林水産課またはJAを通じて申請書を提出」

## 水俣市活用仮説（minamata_use_case）
単なる一般論ではなく、水俣市の具体的資源（不知火海、湯の児・湯の鶴温泉、エコタウン、甘夏・水俣茶の産地、環境モデル都市としての実績等）や課題（人口減少・高齢化、農林業の担い手不足、水俣病対策としての恒久的な医療福祉ニーズ等）を踏まえた具体的な活用アイデアを2〜3文で記載してください。

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
  "minamata_fit_score": 0〜100の整数,
  "minamata_fit_rank": "A | B | C",
  "minamata_fit_reason": "4軸評価に基づく適合理由の解説（2〜3文）",
  "suggested_department": "水俣市役所で主担当になりそうな課",
  "suggested_department_reason": "その課を推定した理由（1〜2文）",
  "minamata_use_case": "水俣市での具体的な活用仮説（2〜3文）",
  "minamata_categories": ["該当するカテゴリをすべて選択"]
}

## minamata_categories の選択肢（複数選択可）
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
