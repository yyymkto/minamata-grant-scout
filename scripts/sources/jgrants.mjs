/**
 * jGrants API ソースプラグイン
 *
 * デジタル庁運営の補助金ポータル（全省庁統合）
 * API: https://api.jgrants-portal.go.jp/exp/v1/public/subsidies
 * 認証不要・レート制限は明記なし
 *
 * 戦略: 「全国」と「熊本県」の募集中補助金を全取得
 */

export const label = "jGrants（全省庁統合）";

const API_BASE = "https://api.jgrants-portal.go.jp/exp";
const LIST_URL = `${API_BASE}/v1/public/subsidies`;
const DETAIL_URL = `${API_BASE}/v2/public/subsidies/id`;

// 水俣市に関連する地域
const TARGET_AREAS = ["全国", "熊本県"];

// 検索キーワード（2文字以上必須）
const KEYWORDS = ["補助金", "交付金", "助成金", "支援事業"];

/**
 * jGrants APIから補助金一覧を取得
 */
async function searchSubsidies(keyword, targetArea) {
  const params = new URLSearchParams({
    keyword,
    acceptance: "1", // 募集中のみ
    sort: "created_date",
    order: "DESC",
  });
  if (targetArea) {
    params.set("target_area_search", targetArea);
  }

  const url = `${LIST_URL}?${params}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TaraGrantScout/1.0 (municipal-grant-research)",
    },
  });

  if (!res.ok) {
    console.error(`  [warn] jGrants API ${res.status} for ${keyword}/${targetArea}`);
    return [];
  }

  const data = await res.json();
  return data.result || [];
}

/**
 * 詳細情報を取得（HTMLのdetailフィールドからプレーンテキスト抽出）
 */
async function fetchDetail(id) {
  try {
    const res = await fetch(`${DETAIL_URL}/${id}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const detail = Array.isArray(data.result) ? data.result[0] : data.result;
    return detail || null;
  } catch {
    return null;
  }
}

/**
 * detail HTMLから省庁名を抽出
 */
const KNOWN_MINISTRIES = [
  "内閣府", "内閣官房", "デジタル庁", "総務省", "法務省", "外務省", "財務省",
  "文部科学省", "厚生労働省", "農林水産省", "経済産業省", "国土交通省", "環境省",
  "防衛省", "復興庁", "観光庁", "林野庁", "水産庁", "中小企業庁",
  "資源エネルギー庁", "特許庁", "消防庁", "文化庁", "スポーツ庁", "こども家庭庁",
];

function extractMinistry(detail) {
  if (!detail) return null;
  const text = (detail.detail || "") + " " + (detail.title || "");
  for (const m of KNOWN_MINISTRIES) {
    if (text.includes(m)) return m;
  }
  return null;
}

/**
 * HTMLタグを除去してプレーンテキストに
 */
function stripHtml(html) {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchGrants() {
  const seen = new Set();
  const grants = [];

  for (const area of TARGET_AREAS) {
    for (const kw of KEYWORDS) {
      console.log(`  [fetch] keyword="${kw}" area="${area}"`);
      const items = await searchSubsidies(kw, area);
      console.log(`    → ${items.length}件`);

      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);

        // jGrantsポータルのURLを生成
        const sourceUrl =
          item.front_subsidy_detail_page_url ||
          `https://www.jgrants-portal.go.jp/subsidy/${item.id}`;

        // 締切の抽出
        let deadline = null;
        if (item.acceptance_end_datetime) {
          deadline = item.acceptance_end_datetime.split("T")[0];
        }

        // 公開日
        let publishedAt = null;
        if (item.acceptance_start_datetime) {
          publishedAt = item.acceptance_start_datetime.split("T")[0];
        }

        grants.push({
          title: item.title,
          source_ministry: "その他", // 詳細取得時に省庁名で上書き
          source_url: sourceUrl,
          published_at: publishedAt,
          deadline,
          raw_text: null, // 詳細取得はオプション（重いため）
          category_raw: [item.use_purpose, item.industry].filter(Boolean).join(" / ") || null,
          _jgrants_id: item.id, // 詳細取得用に保持
          _subsidy_max_limit: item.subsidy_max_limit,
          _target_area: item.target_area_search,
        });
      }
    }
  }

  console.log(`  [info] 重複除去後: ${grants.length}件`);

  // 詳細取得は重いのでオプションにしてもいい。
  // ここではraw_textのために上位N件だけ取得
  const DETAIL_LIMIT = 50;
  const toFetch = grants.slice(0, DETAIL_LIMIT);
  console.log(`  [fetch] 詳細取得: ${toFetch.length}件 (上限${DETAIL_LIMIT})`);

  for (let i = 0; i < toFetch.length; i++) {
    const g = toFetch[i];
    const detail = await fetchDetail(g._jgrants_id);
    if (detail) {
      g.raw_text = stripHtml(detail.detail)?.substring(0, 5000) || null;
      // 省庁名を抽出
      const ministry = extractMinistry(detail);
      if (ministry) {
        g.source_ministry = ministry;
      }
    }
    // レート制限を意識して少し待つ
    if (i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // 内部フィールドを除去
  for (const g of grants) {
    delete g._jgrants_id;
    delete g._subsidy_max_limit;
    delete g._target_area;
  }

  return grants;
}
