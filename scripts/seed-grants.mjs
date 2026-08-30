#!/usr/bin/env node

/**
 * seed-grants.mjs — 水俣市向けリアルな補助金サンプルデータを投入
 *
 * Usage:
 *   node scripts/seed-grants.mjs          # ローカルD1
 *   node scripts/seed-grants.mjs --remote # リモートD1
 */

import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrimaryD1DatabaseName, readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: { remote: { type: "boolean" } },
});
const mode = values.remote ? "--remote" : "--local";

const { config } = await readWranglerConfig();
const dbName = getPrimaryD1DatabaseName(config);
if (!dbName) {
  console.error("d1_databases[0].database_name not found in wrangler.jsonc");
  process.exit(1);
}

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replaceAll("'", "''")}'`;
}

// ── サンプル補助金データ ──────────────────────────

const GRANTS = [
  {
    title: "デジタル田園都市国家構想交付金（デジタル実装タイプ）",
    ministry: "内閣府",
    url: "https://www.chisou.go.jp/sousei/about/digital-denen/index.html",
    published: "2026-01-15",
    deadline: "2026-04-15",
    category: "交付金",
    analysis: {
      summary: "デジタル技術を活用した地域課題解決に取り組む地方自治体を支援する交付金。マイナンバーカード活用や行政DX、遠隔医療等が対象。",
      supportType: "交付金",
      target: "地方自治体",
      maxAmount: "2億円",
      rate: "1/2〜2/3",
      themes: "行政DX, 遠隔医療, マイナンバーカード活用, スマートシティ",
      docs: "実施計画書, KPI設定シート, デジタル実装計画",
      notes: "TYPE1（優良モデル導入）とTYPE2（先行的モデル実装）の2類型あり",
      confidence: 85,
      rank: "A",
      score: 88,
      reason: "水俣市の行政DX推進と遠隔医療ニーズに直接合致。人口減少・高齢化が進む市で遠隔診療や移動支援のデジタル化は大きな効果が期待できる。",
      dept: "地域振興課",
      deptReason: "デジタル田園都市構想は自治体全体のDX推進であり、企画・地域振興部門が主導するのが一般的。",
      useCase: "市立病院と地域をつなぐ遠隔診療システムの構築、高齢者向けオンデマンド交通予約アプリの導入、柑橘農家向け農業IoTセンサーの導入。",
    },
  },
  {
    title: "鳥獣被害防止総合対策交付金",
    ministry: "農林水産省",
    url: "https://www.maff.go.jp/j/seisan/tyozyu/higai/hogai_zyouhou/index.html",
    published: "2026-01-20",
    deadline: "2026-03-31",
    category: "交付金",
    analysis: {
      summary: "イノシシ・シカ等の鳥獣被害防止のため、捕獲活動、侵入防止柵の設置、ジビエ利用等を支援する交付金。",
      supportType: "交付金",
      target: "市町村、地域協議会",
      maxAmount: "1,000万円",
      rate: "1/2",
      themes: "鳥獣被害防止, 捕獲活動, ジビエ, 侵入防止柵",
      docs: "被害防止計画, 実施計画書, 被害状況報告書",
      notes: "地域協議会を設置していることが要件",
      confidence: 90,
      rank: "A",
      score: 83,
      reason: "水俣市は山間部が多くイノシシ・シカ被害が課題。柑橘園や茶畑への被害対策は喫緊の課題であり、直接的に活用できる。",
      dept: "農林水産課",
      deptReason: "鳥獣被害対策は農林水産課が管轄する業務。",
      useCase: "山間部のイノシシ捕獲体制の強化、甘夏・水俣茶の生産地への侵入防止柵設置、捕獲したイノシシのジビエ活用による地域資源化。",
    },
  },
  {
    title: "水産業競争力強化緊急事業",
    ministry: "農林水産省",
    url: "https://www.jfa.maff.go.jp/j/bousai/kyouka.html",
    published: "2026-02-01",
    deadline: "2026-05-15",
    category: "補助金",
    analysis: {
      summary: "漁業・養殖業の競争力強化のため、水産関連施設の整備・改修、養殖施設の高度化等を支援する事業。",
      supportType: "補助金",
      target: "漁業協同組合、水産加工業者、漁業者グループ",
      maxAmount: "5,000万円",
      rate: "1/2",
      themes: "漁業, 養殖業, 水産加工, 施設整備",
      docs: "事業計画書, 収支計画書, 組合決議書",
      notes: "産地水産業強化計画の策定が必要",
      confidence: 80,
      rank: "A",
      score: 87,
      reason: "水俣市の主要産業である不知火海の漁業に直接関連。1997年の水俣湾漁業規制解禁以降、水産資源再生とブランド化を進める市の方針に合致する。",
      dept: "農林水産課",
      deptReason: "水産業関連の補助金は農林水産課が担当。",
      useCase: "不知火海沿岸の漁港施設の改修、水揚げされるタチウオ等のブランド化・直販体制の構築、水質・資源モニタリング体制の強化。",
    },
  },
  {
    title: "地域アカデミー人材育成支援事業",
    ministry: "総務省",
    url: "https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/kaso/index.html",
    published: "2026-01-10",
    deadline: "2026-04-30",
    category: "交付金",
    analysis: {
      summary: "地方公共団体における人口減少対策として、移住・定住促進、産業振興、地域交通確保等の取組を支援する交付金。ソフト事業にも対応。",
      supportType: "交付金",
      target: "人口減少対策に取り組む市町村",
      maxAmount: "3,000万円",
      rate: "1/2〜3/4",
      themes: "移住定住, 産業振興, 地域交通, 集落維持",
      docs: "地域振興計画, 事業計画書, 効果検証計画",
      notes: "人口減少・高齢化が著しい地域であることが前提条件",
      confidence: 88,
      rank: "A",
      score: 89,
      reason: "水俣市は人口減少・高齢化対策が最重要課題。もやい直し（コミュニティ再生）の取組とも連動させ、移住促進や地域交通確保に幅広く活用可能。",
      dept: "地域振興課",
      deptReason: "人口減少対策・移住定住促進は地域振興課の所管。",
      useCase: "移住希望者向けの空き家バンク整備とお試し住居の運営、デマンド型乗合交通の導入による高齢者の移動支援、地域おこし協力隊の活動支援。",
    },
  },
  {
    title: "スマート農業技術の開発・実証プロジェクト",
    ministry: "農林水産省",
    url: "https://www.maff.go.jp/j/kanbo/smart/smart_agri_proj.html",
    published: "2026-02-10",
    deadline: "2026-05-31",
    category: "実証事業",
    analysis: {
      summary: "AI・IoT・ロボット等を活用したスマート農業技術の開発・実証を支援。中山間地域での実証にも重点。",
      supportType: "実証事業",
      target: "農業法人、自治体、研究機関（コンソーシアム）",
      maxAmount: "1億円",
      rate: "定額（委託費）",
      themes: "スマート農業, AI, IoT, ロボット, 中山間地域",
      docs: "研究計画書, コンソーシアム構成員一覧, 知財取扱い規程",
      notes: "農業者とIT企業の連携（コンソーシアム形成）が必須",
      confidence: 75,
      rank: "B",
      score: 70,
      reason: "水俣市の柑橘・茶栽培へのスマート農業技術導入は有望だが、コンソーシアム形成のハードルが高い。大学や企業との連携体制構築が必要。",
      dept: "農林水産課",
      deptReason: "農業関連の技術実証は農林水産課が窓口。",
      useCase: "山間部の柑橘園でのドローン活用（生育モニタリング）、環境保全型農業の効果を可視化するセンサー実証、AIによる最適収穫時期の予測。",
    },
  },
  {
    title: "地域公共交通確保維持改善事業費補助金",
    ministry: "国土交通省",
    url: "https://www.mlit.go.jp/sogoseisaku/transport/sosei_transport_tk_000041.html",
    published: "2026-01-25",
    deadline: "2026-03-20",
    category: "補助金",
    analysis: {
      summary: "地域の生活交通の確保・維持のため、コミュニティバスやデマンド交通の運行経費、車両購入費等を支援。",
      supportType: "補助金",
      target: "市町村、交通事業者",
      maxAmount: null,
      rate: "1/2",
      themes: "地域公共交通, コミュニティバス, デマンド交通",
      docs: "地域公共交通計画, 運行計画書, 収支見込み",
      notes: "地域公共交通会議での協議が必要",
      confidence: 85,
      rank: "A",
      score: 86,
      reason: "水俣市は高齢化が進み、高齢者の移動手段確保が重要課題。デマンド交通やコミュニティバスの導入・維持に直結する。",
      dept: "地域振興課",
      deptReason: "地域交通政策は地域振興課が担当。",
      useCase: "市内デマンド型乗合タクシーの拡充、市立病院・買い物拠点を結ぶ高齢者向け巡回バスの運行維持。",
    },
  },
  {
    title: "脱炭素先行地域づくり事業",
    ministry: "環境省",
    url: "https://policies.env.go.jp/policy/roadmap/preceding-region/",
    published: "2026-02-15",
    deadline: "2026-06-30",
    category: "交付金",
    analysis: {
      summary: "2030年度までに民生部門の電力消費由来CO2実質ゼロを実現する先行地域を選定し、再エネ導入等を支援。",
      supportType: "交付金",
      target: "地方自治体（共同提案可）",
      maxAmount: "50億円",
      rate: "2/3〜3/4",
      themes: "脱炭素, 再生可能エネルギー, 省エネ, 地域循環",
      docs: "脱炭素先行地域計画提案書, CO2削減計画, 地域合意形成の記録",
      notes: "第5回選定（予定）。計画策定の準備期間が必要",
      confidence: 88,
      rank: "A",
      score: 90,
      reason: "水俣市は1992年に全国初の「環境モデル都市づくり宣言」を行い、2008年に国の環境モデル都市に認定された実績を持つ。脱炭素先行地域の趣旨と極めて高い親和性がある。",
      dept: "環境課",
      deptReason: "脱炭素・環境政策は環境課の所管。",
      useCase: "エコタウン地区への再エネ設備の追加導入、公共施設への太陽光パネル設置、環境モデル都市としての知見を活かした地域一体型の脱炭素モデル構築。",
    },
  },
  {
    title: "地域医療介護総合確保基金事業",
    ministry: "厚生労働省",
    url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000060713.html",
    published: "2026-01-05",
    deadline: "2026-04-10",
    category: "補助金",
    analysis: {
      summary: "地域における医療・介護サービスの総合的な確保のため、在宅医療推進、介護施設整備、人材確保等を支援。",
      supportType: "補助金",
      target: "都道府県（市町村経由で申請）",
      maxAmount: null,
      rate: "2/3",
      themes: "地域医療, 介護, 在宅医療, 人材確保",
      docs: "事業計画書（県経由）, 地域医療構想との整合性説明",
      notes: "都道府県の基金事業として実施。県との連携が必須",
      confidence: 78,
      rank: "B",
      score: 74,
      reason: "水俣病対策として恒久的な医療・福祉ニーズを抱える水俣市にとって重要な施策。県経由の申請となるため手続きは複雑だが、高齢化に伴う在宅医療の推進は市の重点課題に合致する。",
      dept: "いきいき健康課",
      deptReason: "医療・介護関連の施策はいきいき健康課が所管。",
      useCase: "在宅医療・訪問看護体制の強化、水俣病被害者を含む高齢者への継続的な医療・介護提供体制の充実、介護人材の確保・育成研修の実施。",
    },
  },
  {
    title: "地域なりわい再生緊急対策交付金",
    ministry: "経済産業省",
    url: "https://www.meti.go.jp/policy/sme_chiiki/chiiki/nariwai.html",
    published: "2026-02-20",
    deadline: "2026-05-20",
    category: "交付金",
    analysis: {
      summary: "地域の中小企業・小規模事業者のなりわい再生を支援。商店街活性化、観光振興、特産品開発等が対象。",
      supportType: "交付金",
      target: "市町村、商工会、商工会議所",
      maxAmount: "5,000万円",
      rate: "3/4",
      themes: "中小企業支援, 商店街活性化, 観光振興, 特産品開発",
      docs: "なりわい再生計画, 事業計画書, 商工会議所等の推薦書",
      notes: "商工会議所等との連携が要件",
      confidence: 72,
      rank: "B",
      score: 68,
      reason: "甘夏・水俣茶等の特産品ブランディングや湯の児・湯の鶴温泉の観光振興に活用できるが、「緊急対策」の要件に該当するか確認が必要。",
      dept: "経済観光戦略課",
      deptReason: "商工振興・観光政策は経済観光戦略課の担当。",
      useCase: "甘夏・水俣茶のブランディング強化、環境学習ツアーと連携した観光コンテンツの磨き上げ、中心市街地の空き店舗を活用した地域物産拠点の整備。",
    },
  },
  {
    title: "みどりの食料システム戦略推進交付金",
    ministry: "農林水産省",
    url: "https://www.maff.go.jp/j/kanbo/kankyo/seisaku/midori/index.html",
    published: "2026-02-05",
    deadline: "2026-04-20",
    category: "交付金",
    analysis: {
      summary: "有機農業の拡大や化学肥料・農薬の低減など、環境保全型農業への転換を支援する交付金。オーガニックビレッジ推進も対象。",
      supportType: "交付金",
      target: "市町村、農業者団体",
      maxAmount: "1,000万円",
      rate: "定額・1/2等",
      themes: "有機農業, 環境保全型農業, オーガニックビレッジ, 化学肥料低減",
      docs: "推進計画書, 地域農業者との合意形成資料",
      notes: "オーガニックビレッジ宣言を行う市町村は優先採択枠あり",
      confidence: 85,
      rank: "A",
      score: 91,
      reason: "無農薬・環境保全型農業を市を挙げて推進してきた水俣市の歴史・環境マイスター制度と正面から合致する。環境モデル都市としてのブランドを農業分野でも強化できる。",
      dept: "農林水産課",
      deptReason: "環境保全型農業の推進は農林水産課の担当。",
      useCase: "甘夏・水俣茶生産者への環境保全型農業技術の普及支援、環境マイスター認定農家の拡大、オーガニックビレッジ宣言による地域ブランド化。",
    },
  },
  {
    title: "防災・減災、国土強靱化のための5か年加速化対策",
    ministry: "国土交通省",
    url: "https://www.cas.go.jp/jp/seisaku/kokudo_kyoujinka/index.html",
    published: "2026-01-30",
    deadline: null,
    category: "補助金",
    analysis: {
      summary: "激甚化する風水害や切迫する大規模地震への対策として、インフラ老朽化対策、流域治水、道路ネットワーク機能確保等を支援。",
      supportType: "補助金",
      target: "都道府県、市町村",
      maxAmount: null,
      rate: "1/2〜2/3",
      themes: "防災, 減災, インフラ老朽化対策, 流域治水, 耐震化",
      docs: "個別補助制度による",
      notes: "個別の補助メニューごとに要件が異なる。県との連携で申請",
      confidence: 65,
      rank: "B",
      score: 60,
      reason: "水俣市は不知火海沿岸で高潮・風水害のリスクがあり、山間部は土砂災害リスクも抱える。インフラ老朽化対策にも使えるが、個別メニューの確認が必要。",
      dept: "土木課",
      deptReason: "防災インフラ整備は土木課が主担当。",
      useCase: "不知火海沿岸の高潮対策護岸の強化、山間部の急傾斜地対策、公共施設の耐震改修。",
    },
  },
  {
    title: "GIGAスクール構想推進事業",
    ministry: "文部科学省",
    url: "https://www.mext.go.jp/a_menu/other/index_00001.htm",
    published: "2026-02-25",
    deadline: "2026-06-15",
    category: "補助金",
    analysis: {
      summary: "GIGAスクール構想の次のステップとして、1人1台端末の更新、ネットワーク環境の強化、デジタル教材の活用促進等を支援。",
      supportType: "補助金",
      target: "市町村教育委員会",
      maxAmount: null,
      rate: "1/2",
      themes: "教育DX, ICT教育, 端末更新, デジタル教材",
      docs: "整備計画書, ICT活用教育推進計画",
      notes: "端末更新は2025年度から本格化。計画的な申請が重要",
      confidence: 78,
      rank: "C",
      score: 45,
      reason: "教育DXは重要だが、水俣市固有の課題（環境教育・水俣病の伝承等）との直接的な関連は薄い。他の自治体と同様の取組になりやすい。",
      dept: "教育課",
      deptReason: "学校ICT整備・教育DXは教育課の所管。",
      useCase: "小中学校のタブレット端末更新、校内ネットワークの高速化、水俣病資料館と連携したデジタル環境学習教材の整備。",
    },
  },
];

// ── SQL生成 ──────────────────────────────────

const statements = ["BEGIN TRANSACTION;"];

for (const g of GRANTS) {
  const a = g.analysis;
  statements.push(
    `INSERT INTO grants (title, source_ministry, source_url, published_at, deadline, category_raw)
     VALUES (${esc(g.title)}, ${esc(g.ministry)}, ${esc(g.url)}, ${esc(g.published)}, ${esc(g.deadline)}, ${esc(g.category)})
     ON CONFLICT(source_url) DO UPDATE SET
       title = excluded.title,
       source_ministry = excluded.source_ministry,
       published_at = excluded.published_at,
       deadline = excluded.deadline,
       category_raw = excluded.category_raw,
       updated_at = datetime('now');`
  );

  statements.push(
    `INSERT INTO grant_ai_analyses (grant_id, summary_short, support_type, target_entities, max_amount, subsidy_rate, eligible_themes, required_documents, notes, ai_confidence, minamata_fit_rank, minamata_fit_score, minamata_fit_reason, suggested_department, suggested_department_reason, minamata_use_case)
     SELECT g.id, ${esc(a.summary)}, ${esc(a.supportType)}, ${esc(a.target)}, ${esc(a.maxAmount)}, ${esc(a.rate)}, ${esc(a.themes)}, ${esc(a.docs)}, ${esc(a.notes)}, ${a.confidence}, ${esc(a.rank)}, ${a.score}, ${esc(a.reason)}, ${esc(a.dept)}, ${esc(a.deptReason)}, ${esc(a.useCase)}
     FROM grants g WHERE g.source_url = ${esc(g.url)}
     ON CONFLICT(grant_id) DO UPDATE SET
       summary_short = excluded.summary_short,
       support_type = excluded.support_type,
       target_entities = excluded.target_entities,
       max_amount = excluded.max_amount,
       subsidy_rate = excluded.subsidy_rate,
       eligible_themes = excluded.eligible_themes,
       required_documents = excluded.required_documents,
       notes = excluded.notes,
       ai_confidence = excluded.ai_confidence,
       minamata_fit_rank = excluded.minamata_fit_rank,
       minamata_fit_score = excluded.minamata_fit_score,
       minamata_fit_reason = excluded.minamata_fit_reason,
       suggested_department = excluded.suggested_department,
       suggested_department_reason = excluded.suggested_department_reason,
       minamata_use_case = excluded.minamata_use_case,
       updated_at = datetime('now');`
  );
}

statements.push("COMMIT;");

const sql = statements.join("\n");

// SQLが長大になるため、コマンドライン引数ではなく一時ファイル経由で渡す（Windowsのコマンドライン長制限を回避）
const tempDir = mkdtempSync(join(tmpdir(), "minamata-grant-scout-seed-"));
const sqlFile = join(tempDir, "seed.sql");
writeFileSync(sqlFile, sql, "utf-8");

let result;
try {
  result = spawnSync("wrangler", ["d1", "execute", dbName, mode, "--file", sqlFile], {
    stdio: "inherit",
    shell: true,
  });
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

console.log("");
console.log(`✓ ${GRANTS.length}件の補助金サンプルデータを投入しました`);
console.log(`  ランクA: ${GRANTS.filter((g) => g.analysis.rank === "A").length}件`);
console.log(`  ランクB: ${GRANTS.filter((g) => g.analysis.rank === "B").length}件`);
console.log(`  ランクC: ${GRANTS.filter((g) => g.analysis.rank === "C").length}件`);
