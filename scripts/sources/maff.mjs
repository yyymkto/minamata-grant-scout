/**
 * 農林水産省の補助金・公募情報スクレイパー
 *
 * ソース: https://www.maff.go.jp/j/supply/hozyo/
 * 構造: table.datatable に 公告日 | 締切日 | 件名(リンク付き) の3カラム
 * 日付: 和暦（令和8年3月12日）
 * URL: 相対パス（./syouan/260312_101-1.html）
 */

import * as cheerio from "cheerio";

export const label = "農林水産省";

const BASE_URL = "https://www.maff.go.jp";
const LIST_URL = `${BASE_URL}/j/supply/hozyo/`;

/**
 * 和暦（令和X年Y月Z日）をISO日付に変換
 */
function warekiToISO(text) {
  if (!text) return null;
  const m = text.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  const year = 2018 + Number(m[1]);
  const month = String(m[2]).padStart(2, "0");
  const day = String(m[3]).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 相対URLを絶対URLに変換
 */
function resolveUrl(href) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("./")) {
    return `${LIST_URL}${href.slice(2)}`;
  }
  if (href.startsWith("/")) {
    return `${BASE_URL}${href}`;
  }
  return `${LIST_URL}${href}`;
}

/**
 * 農水省の公募一覧テーブルから情報を抽出
 */
export async function fetchGrants() {
  console.log(`  [fetch] ${LIST_URL}`);

  let html;
  try {
    const res = await fetch(LIST_URL, {
      headers: {
        "User-Agent": "TaraGrantScout/1.0 (municipal-grant-research)",
      },
    });
    if (!res.ok) {
      console.error(`  [warn] HTTP ${res.status}`);
      return [];
    }
    html = await res.text();
  } catch (err) {
    console.error(`  [warn] フェッチ失敗: ${err.message}`);
    return [];
  }

  const $ = cheerio.load(html);
  const grants = [];

  // table.datatable の各行を走査（1行目はヘッダ）
  $("table.datatable tr").each((i, row) => {
    if (i === 0) return; // ヘッダ行スキップ

    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const publishedRaw = $(cells[0]).text().trim();
    const deadlineRaw = $(cells[1]).text().trim();
    const titleCell = $(cells[2]);
    // <a id="..."> のアンカーIDと <a href="..."> のリンクが並んでいる。href付きを取る
    const link = titleCell.find("a[href]").first();
    const title = (link.length ? link.text() : titleCell.text()).trim().replace(/\s+/g, " ");
    const href = link.attr("href");

    if (!title || title.length < 5) return;

    const sourceUrl = resolveUrl(href);
    if (!sourceUrl) return;

    grants.push({
      title,
      source_ministry: "農林水産省",
      source_url: sourceUrl,
      published_at: warekiToISO(publishedRaw),
      deadline: warekiToISO(deadlineRaw),
      raw_text: null,
      category_raw: null,
    });
  });

  // table.datatable がなかった場合のフォールバック:
  // ページ構造が変わった可能性があるので、リンクベースで拾う
  if (grants.length === 0) {
    console.log("  [info] table.datatable が見つからず。フォールバック抽出中...");

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim().replace(/\s+/g, " ");
      if (!href || !text || text.length < 10) return;

      const keywords = ["公募", "補助", "交付金", "助成", "募集"];
      if (!keywords.some((k) => text.includes(k))) return;

      const url = resolveUrl(href);
      if (!url || !url.startsWith("http")) return;

      grants.push({
        title: text,
        source_ministry: "農林水産省",
        source_url: url,
        published_at: null,
        deadline: null,
        raw_text: null,
        category_raw: null,
      });
    });
  }

  // 重複除去（URLベース）
  const seen = new Set();
  const unique = grants.filter((g) => {
    if (seen.has(g.source_url)) return false;
    seen.add(g.source_url);
    return true;
  });

  console.log(`  [info] ${unique.length}件の公募情報を抽出`);
  return unique;
}
