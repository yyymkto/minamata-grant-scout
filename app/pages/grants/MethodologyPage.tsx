import { Link } from "wouter";
import { useScoringProfile } from "../../hooks/useGrants";
import type {
  ScoringIndustry,
  ScoringTheme,
  ScoringTimeLimitedModifier,
  ScoringUniquenessTag,
} from "../../hooks/useGrants";

function confidenceBadge(confidence: "high" | "medium" | "low") {
  switch (confidence) {
    case "high":
      return { label: "確度: 高", className: "bg-emerald-100 text-emerald-700" };
    case "medium":
      return { label: "確度: 中", className: "bg-amber-100 text-amber-700" };
    default:
      return { label: "確度: 低", className: "bg-gray-100 text-gray-500" };
  }
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-gray-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function IndustryRow({ industry }: { industry: ScoringIndustry }) {
  const badge = confidenceBadge(industry.confidence);
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{industry.label}</p>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
          <span className="tabular-nums text-sm font-bold text-indigo-600">
            {industry.base}
            <span className="ml-0.5 text-xs font-normal text-gray-400">/100</span>
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{industry.rationale}</p>
      <p className="mt-1 text-[11px] text-gray-400">
        就業者シェア指数 E={industry.E} ・ 付加価値指数 V={industry.V} ・ 政策優先指数 P={industry.P}
      </p>
    </div>
  );
}

function ThemeRow({ theme }: { theme: ScoringTheme }) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{theme.label}</p>
        <span className="tabular-nums text-sm font-bold text-indigo-600">
          P {theme.P}
          <span className="ml-0.5 text-xs font-normal text-gray-400">/5.0</span>
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{theme.basis}</p>
    </div>
  );
}

function UniquenessTagRow({ tag }: { tag: ScoringUniquenessTag }) {
  const badge = confidenceBadge(tag.confidence);
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{tag.label}</p>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
          <span className="tabular-nums text-sm font-bold text-emerald-700">+{tag.bonus}点</span>
        </div>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{tag.appliesWhen}</p>
      {tag.examples && tag.examples.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-gray-400">
          {tag.examples.map((ex) => (
            <li key={ex}>{ex}</li>
          ))}
        </ul>
      )}
      {tag.doNotApplyTo && tag.doNotApplyTo.length > 0 && (
        <p className="mt-1 text-[11px] text-gray-400">
          付けない対象: {tag.doNotApplyTo.join("、")}
        </p>
      )}
    </div>
  );
}

function TimeLimitedRow({ modifier }: { modifier: ScoringTimeLimitedModifier }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        modifier.active ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-gray-50 opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{modifier.label}</p>
        <span
          className={`tabular-nums text-sm font-bold ${modifier.active ? "text-indigo-600" : "text-gray-400"}`}
        >
          +{modifier.bonus}点
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {modifier.active ? "現在有効" : "失効済み"} ・ 〜{modifier.validUntil}
        {modifier.note && ` ・ ${modifier.note}`}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 rounded-xl border border-gray-200 bg-gray-100" />
      ))}
    </div>
  );
}

export function MethodologyPage() {
  const { data, isLoading } = useScoringProfile();

  if (isLoading || !data) {
    return <Skeleton />;
  }

  const { scoringModel, industries, themes, uniquenessTags, timeLimitedModifiers } = data;
  const sortedIndustries = [...industries].sort((a, b) => b.base - a.base);
  const sortedThemes = [...themes].sort((a, b) => b.P - a.P);
  const sortedTags = [...uniquenessTags].sort((a, b) => b.bonus - a.bonus);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/grants"
          className="inline-flex cursor-pointer items-center gap-1 text-sm text-indigo-600 transition-all duration-200 hover:text-indigo-500 hover:gap-1.5"
        >
          <span aria-hidden="true">←</span> 一覧に戻る
        </Link>
        <h1 className="mt-3 text-xl font-bold text-gray-900 sm:text-2xl">AIによる評価方法について</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          このシステムでは、AI（大規模言語モデル）が補助金・公募情報を「どの産業」「どの政策テーマ」
          「水俣市固有の制度・資産」に該当するかに分類し、その分類結果から
          <strong className="font-semibold text-gray-800">スコア（0〜100点）とA/B/Cランクを機械的に計算</strong>
          しています。AIに点数そのものを決めさせるのではなく、分類だけを任せることで、
          同じ内容の補助金には常に同じ根拠で同じ点数がつくようにしています。
        </p>
      </div>

      <Section title="スコアの内訳" description="最終スコア（0〜100点）は、以下の合計です。">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">産業適合度</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {Math.round(scoringModel.scoreComposition.industryFit * 100)}%
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">テーマ適合度</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {Math.round(scoringModel.scoreComposition.themeFit * 100)}%
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">固有性加点</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              最大+{scoringModel.scoreComposition.uniquenessBonusMax}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">時限加点</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              最大+{scoringModel.scoreComposition.timeLimitedModifierMax}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          産業適合度・テーマ適合度は、補助金が該当する産業・政策テーマのうち最も点数の高いものを採用します
          （複数該当する場合の単純合算はしません）。加えて、大企業限定・三大都市圏限定など水俣市の対象者が
          そもそも応募できない場合や、募集が実質的に終了している場合は、他の点数にかかわらずスコアを大きく
          抑制する仕組みになっています。
        </p>
      </Section>

      <Section
        title="ランクの基準"
        description="上記スコアの合計から、以下の基準で機械的にランクを決定します（AIの主観は入りません）。"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-100 text-xs font-bold text-emerald-800">
              A
            </span>
            <p className="mt-2 text-xs text-gray-700">75点以上 ー 直ちに応募・周知を検討すべき有望な補助金</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-xs font-bold text-amber-800">
              B
            </span>
            <p className="mt-2 text-xs text-gray-700">50〜74点 ー 条件付き・間接的に活用余地がある補助金</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-500">
              C
            </span>
            <p className="mt-2 text-xs text-gray-700">49点以下 ー 水俣市との関連性が薄い（一覧では非表示）</p>
          </div>
        </div>
      </Section>

      <Section
        title="産業ごとの重点度"
        description="水俣市の就業者シェア・付加価値・総合計画等での政策優先度から算出した、産業ごとの基礎点（0〜100点満点。産業適合度スコアの計算に使用）です。"
      >
        <div>
          {sortedIndustries.map((industry) => (
            <IndustryRow key={industry.key} industry={industry} />
          ))}
        </div>
      </Section>

      <Section
        title="政策テーマごとの優先度"
        description="産業をまたぐ、または産業分類を持たない補助金（移住支援・防災・DX等）は、水俣市の計画上の政策優先度（0〜5）で評価します。"
      >
        <div>
          {sortedThemes.map((theme) => (
            <ThemeRow key={theme.key} theme={theme} />
          ))}
        </div>
      </Section>

      <Section
        title="水俣固有性による加点"
        description="他の自治体では代替の効かない、水俣市だからこそ該当する制度・歴史的資産に合致する場合に加点します（複数該当時は合計、上限あり）。"
      >
        <div>
          {sortedTags.map((tag) => (
            <UniquenessTagRow key={tag.key} tag={tag} />
          ))}
        </div>
      </Section>

      <Section
        title="期間限定の加点"
        description="災害対応など、時期に応じた特別加点です。期限を過ぎると自動的に無効になります。"
      >
        <div className="space-y-2">
          {timeLimitedModifiers.map((modifier) => (
            <TimeLimitedRow key={modifier.key} modifier={modifier} />
          ))}
        </div>
      </Section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-500 sm:p-5">
        <p className="font-semibold text-gray-600">データの限界について</p>
        <p className="mt-1.5">
          上記の数値は、国勢調査・地域経済循環分析・水俣市総合計画・過疎地域持続的発展計画等の
          公開情報をもとに設定していますが、一部は確度「中」「低」の推定値を含みます。総合計画の
          改定（2027年頃見込み）や各種統計の更新に合わせて見直す予定です。また、AIによる分類には
          誤りが含まれる可能性があるため、実際の応募にあたっては必ず公式サイト・所管課で最新情報を
          ご確認ください。
        </p>
      </section>
    </div>
  );
}
