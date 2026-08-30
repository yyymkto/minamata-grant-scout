/**
 * 熊本県公式サイト RSSソース — 県独自の補助金・助成金情報（jGrantsには載らない）
 *
 * 熊本県公式サイト(pref.kumamoto.jp)は部署（組織）ごとにRSS（新着情報）を配信している。
 * URLパターンは /rss/10/soshiki-{部グループ番号}-{組織番号}.xml で、部グループ番号は
 * 組織番号と一致しない（例: 組織73は部グループ7）ため、各部署ページを個別に確認して
 * 決め打ちしている。
 *
 * 戦略: 対象部署のRSSから新着記事一覧を取得 → タイトルに補助金関連キーワードを含み、
 * かつ「募集終了」等の記載がないものだけを抽出。記事本文はQueue経由の詳細取得ステップで
 * 個別に取得する（1回のWorker呼び出しあたりのsubrequest数を抑えるため、一覧取得と
 * 本文取得を分離している）。
 */
import { logEvent } from "../../lib/logging";

const BASE_URL = "https://www.pref.kumamoto.jp";
const FETCH_TIMEOUT_MS = 15_000;

// 対象部署のRSS（水俣市の産業構造に関連が深い分野を優先）
const KUMAMOTO_PREF_FEEDS = [
  "/rss/10/soshiki-6-61.xml", // 商工振興金融課
  "/rss/10/soshiki-7-71.xml", // 農林水産政策課
  "/rss/10/soshiki-7-73.xml", // 流通アグリビジネス課
  "/rss/10/soshiki-6-67.xml", // エネルギー政策課
  "/rss/10/soshiki-5-53.xml", // 循環社会推進課
  "/rss/10/soshiki-28-208.xml", // 観光振興課
  "/rss/10/soshiki-4-36.xml", // 子ども家庭福祉課
  "/rss/10/soshiki-4-27.xml", // 健康福祉政策課
];

const GRANT_KEYWORD_PATTERN = /(補助金|助成金|支援金|給付金|公募|交付金)/;
const CLOSED_KEYWORD_PATTERN = /(募集終了|受付終了|受付を終了|終了しました)/;

export interface KumamotoPrefRawGrant {
  title: string;
  source_ministry: string;
  source_url: string;
  published_at: string | null;
  deadline: string | null;
  raw_text: string | null;
  category_raw: string | null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface FeedItem {
  url: string;
  title: string;
  date: string | null;
  category: string | null;
}

async function fetchFeed(
  path: string
): Promise<{ departmentName: string; items: FeedItem[] } | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Accept: "application/xml",
        "User-Agent": "MinamataGrantScout/1.0 (municipal-grant-research)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      logEvent("warn", "kumamoto_pref.feed_error", { path, status: res.status });
      return null;
    }
    const xml = await res.text();

    const titleMatch = xml.match(/<title>熊本県RSS（([^）]*)）<\/title>/);
    const departmentName = titleMatch ? titleMatch[1].trim() : "熊本県";

    const items: FeedItem[] = [];
    const itemRegex = /<item rdf:about="([^"]+)">([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml))) {
      const url = m[1];
      const body = m[2];
      const title = body.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const date = body.match(/<dc:date>([\s\S]*?)<\/dc:date>/)?.[1] ?? null;
      const category = body.match(/<nc:category01>([\s\S]*?)<\/nc:category01>/)?.[1]?.trim() || null;
      if (title) {
        items.push({ url, title: decodeEntities(title.trim()), date, category });
      }
    }
    return { departmentName, items };
  } catch (err) {
    logEvent("warn", "kumamoto_pref.feed_exception", {
      path,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** 対象部署のRSSから、補助金関連の新着記事一覧のみを取得（本文取得なし） */
export async function fetchKumamotoPrefGrantList(): Promise<KumamotoPrefRawGrant[]> {
  const grants: KumamotoPrefRawGrant[] = [];

  for (const path of KUMAMOTO_PREF_FEEDS) {
    const feed = await fetchFeed(path);
    if (!feed) continue;

    for (const item of feed.items) {
      if (!GRANT_KEYWORD_PATTERN.test(item.title)) continue;
      if (CLOSED_KEYWORD_PATTERN.test(item.title)) continue;

      grants.push({
        title: item.title,
        source_ministry: `熊本県 ${feed.departmentName}`,
        source_url: item.url,
        published_at: item.date ? item.date.slice(0, 10) : null,
        deadline: null,
        raw_text: null,
        category_raw: item.category,
      });
    }
  }

  logEvent("info", "kumamoto_pref.list_total", { count: grants.length });
  return grants;
}

/** 1件の記事本文を取得（main_body領域のみ抽出、ヘッダー・フッター等のノイズを除外） */
export async function fetchKumamotoPrefArticleBody(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "MinamataGrantScout/1.0 (municipal-grant-research)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const m = html.match(/<div id="main_body"[^>]*>([\s\S]*?)<div id="content_footer"/);
    if (!m) return null;

    return stripHtml(m[1]).substring(0, 5000) || null;
  } catch (err) {
    logEvent("warn", "kumamoto_pref.article_exception", {
      url,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
