/**
 * jGrants API ソース — 全省庁統合の補助金ポータル
 */
import { logEvent } from "../../lib/logging";

const FETCH_TIMEOUT_MS = 15_000;
const API_BASE = "https://api.jgrants-portal.go.jp/exp";
const LIST_URL = `${API_BASE}/v1/public/subsidies`;
const DETAIL_URL = `${API_BASE}/v2/public/subsidies/id`;

const TARGET_AREAS = ["全国", "熊本県"];
const KEYWORDS = ["補助金", "交付金", "助成金", "支援事業"];

const KNOWN_MINISTRIES = [
  "内閣府", "内閣官房", "デジタル庁", "総務省", "法務省", "外務省", "財務省",
  "文部科学省", "厚生労働省", "農林水産省", "経済産業省", "国土交通省", "環境省",
  "防衛省", "復興庁", "観光庁", "林野庁", "水産庁", "中小企業庁",
  "資源エネルギー庁", "特許庁", "消防庁", "文化庁", "スポーツ庁", "こども家庭庁",
];

export interface RawGrant {
  title: string;
  source_ministry: string;
  source_url: string;
  published_at: string | null;
  deadline: string | null;
  raw_text: string | null;
  category_raw: string | null;
  jgrants_id: string;
}

interface JGrantsListItem {
  id: string;
  title: string;
  front_subsidy_detail_page_url?: string;
  acceptance_end_datetime?: string;
  acceptance_start_datetime?: string;
  use_purpose?: string;
  industry?: string;
  subsidy_max_limit?: string;
  target_area_search?: string;
}

interface JGrantsDetail {
  detail?: string;
  title?: string;
}

async function searchSubsidies(keyword: string, targetArea: string): Promise<JGrantsListItem[]> {
  const params = new URLSearchParams({
    keyword,
    acceptance: "1",
    sort: "created_date",
    order: "DESC",
  });
  if (targetArea) {
    params.set("target_area_search", targetArea);
  }

  const res = await fetch(`${LIST_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MinamataGrantScout/1.0 (municipal-grant-research)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    logEvent("warn", "jgrants.list_error", { status: res.status, keyword, targetArea });
    return [];
  }

  const data = (await res.json()) as { result?: JGrantsListItem[] };
  return data.result || [];
}

async function fetchDetail(id: string): Promise<JGrantsDetail | null> {
  try {
    const res = await fetch(`${DETAIL_URL}/${id}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: JGrantsDetail | JGrantsDetail[] };
    const detail = Array.isArray(data.result) ? data.result[0] : data.result;
    return detail || null;
  } catch {
    return null;
  }
}

function extractMinistry(detail: JGrantsDetail): string | null {
  const text = (detail.detail || "") + " " + (detail.title || "");
  for (const m of KNOWN_MINISTRIES) {
    if (text.includes(m)) return m;
  }
  return null;
}

function stripHtml(html: string | undefined): string | null {
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

/** jGrants APIから補助金一覧を取得（詳細取得なし） */
export async function fetchGrantList(): Promise<RawGrant[]> {
  const seen = new Set<string>();
  const grants: RawGrant[] = [];

  for (const area of TARGET_AREAS) {
    for (const kw of KEYWORDS) {
      logEvent("info", "jgrants.search", { keyword: kw, area });
      const items = await searchSubsidies(kw, area);
      logEvent("info", "jgrants.search_result", { keyword: kw, area, count: items.length });

      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);

        const sourceUrl =
          item.front_subsidy_detail_page_url ||
          `https://www.jgrants-portal.go.jp/subsidy/${item.id}`;

        let deadline: string | null = null;
        if (item.acceptance_end_datetime) {
          deadline = item.acceptance_end_datetime.split("T")[0];
        }

        let publishedAt: string | null = null;
        if (item.acceptance_start_datetime) {
          publishedAt = item.acceptance_start_datetime.split("T")[0];
        }

        grants.push({
          title: item.title,
          source_ministry: "その他",
          source_url: sourceUrl,
          published_at: publishedAt,
          deadline,
          raw_text: null,
          category_raw: [item.use_purpose, item.industry].filter(Boolean).join(" / ") || null,
          jgrants_id: item.id,
        });
      }
    }
  }

  logEvent("info", "jgrants.dedup_total", { count: grants.length });
  return grants;
}

/** 1件の詳細を取得してraw_text・省庁名を埋める */
export async function enrichGrantDetail(grant: RawGrant): Promise<void> {
  const detail = await fetchDetail(grant.jgrants_id);
  if (!detail) return;

  grant.raw_text = stripHtml(detail.detail)?.substring(0, 5000) || null;
  const ministry = extractMinistry(detail);
  if (ministry) {
    grant.source_ministry = ministry;
  }
}
