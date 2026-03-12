/**
 * e-Gov公募情報スクレイパー
 *
 * e-Gov（電子政府の総合窓口）の補助金・公募情報を取得
 * https://shinsei.e-gov.go.jp/ の公募情報ページから最新情報を収集
 *
 * NOTE: 本番運用時はe-Gov APIやRSS等に移行推奨
 */

import * as cheerio from "cheerio";

export const label = "e-Gov（電子政府）";

const TARGET_URL = "https://shinsei.e-gov.go.jp/search/servlet/Procedure";

/**
 * 公募情報を取得して正規化された配列を返す
 * @returns {Promise<Array<{title, source_ministry, source_url, deadline?, raw_text?, category_raw?}>>}
 */
export async function fetchGrants() {
  // NOTE: e-Govの検索APIは動的でスクレイピングが困難なため、
  //       本番ではe-Gov APIキーを取得して利用するのが望ましい。
  //       ここでは構造のスタブとして返す。
  console.log("  [info] e-Gov source: 現在スタブモード（実装予定）");
  return [];
}
