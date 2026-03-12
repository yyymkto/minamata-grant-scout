import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGrant } from "../../hooks/useGrants";

function rankColor(rank: string | null) {
  switch (rank) {
    case "A":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "B":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "C":
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    default:
      return "bg-slate-700/50 text-slate-500 border-slate-600/30";
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="py-1.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-white whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export function GrantDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const { data, isLoading } = useGrant(id);
  const [showRaw, setShowRaw] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <p className="text-sm text-slate-400">読み込み中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <p className="text-sm text-slate-400">補助金が見つかりません</p>
      </div>
    );
  }

  const a = data.analysis;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link href="/grants" className="text-sm text-indigo-400 hover:text-indigo-300">
        ← 一覧に戻る
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          {a?.taraFitRank && (
            <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-sm font-bold ${rankColor(a.taraFitRank)}`}>
              ランク {a.taraFitRank}
              {a.taraFitScore != null && (
                <span className="ml-1.5 text-xs font-normal opacity-75">({a.taraFitScore}点)</span>
              )}
            </span>
          )}
          <span className="text-sm text-slate-400">{data.sourceMinistry}</span>
        </div>
        <h1 className="mt-2 text-xl font-bold text-white leading-snug">{data.title}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
          {data.deadline && <span>締切: {data.deadline}</span>}
          {data.publishedAt && <span>公開: {data.publishedAt}</span>}
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300"
          >
            元ページを開く
          </a>
        </div>
      </div>

      {/* AI Summary */}
      {a?.summaryShort && (
        <Section title="AI要約">
          <p className="text-sm text-white leading-relaxed">{a.summaryShort}</p>
        </Section>
      )}

      {/* Grant details */}
      {a && (
        <Section title="制度の概要">
          <dl className="divide-y divide-slate-700/50">
            <Field label="支援タイプ" value={a.supportType} />
            <Field label="対象者" value={a.targetEntities} />
            <Field label="補助額上限" value={a.maxAmount} />
            <Field label="補助率" value={a.subsidyRate} />
            <Field label="対象テーマ" value={a.eligibleThemes} />
            <Field label="必要書類" value={a.requiredDocuments} />
            <Field label="備考" value={a.notes} />
            {a.aiConfidence != null && (
              <Field label="AI確度" value={`${a.aiConfidence}%`} />
            )}
          </dl>
        </Section>
      )}

      {/* Tara fit */}
      {a?.taraFitReason && (
        <Section title="太良町との相性">
          <p className="text-sm text-white leading-relaxed">{a.taraFitReason}</p>
        </Section>
      )}

      {/* Department */}
      {a?.suggestedDepartment && (
        <Section title="想定担当課">
          <p className="text-sm font-medium text-indigo-400">{a.suggestedDepartment}</p>
          {a.suggestedDepartmentReason && (
            <p className="mt-1 text-sm text-slate-300">{a.suggestedDepartmentReason}</p>
          )}
        </Section>
      )}

      {/* Use case */}
      {a?.taraUseCase && (
        <Section title="太良町での活用仮説">
          <p className="text-sm text-white leading-relaxed">{a.taraUseCase}</p>
        </Section>
      )}

      {/* Raw text */}
      {data.rawText && (
        <div>
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            {showRaw ? "▼ 原文を閉じる" : "▶ 原文を表示"}
          </button>
          {showRaw && (
            <div className="mt-2 rounded-xl border border-slate-700/50 bg-slate-900 p-4">
              <pre className="whitespace-pre-wrap text-xs text-slate-400 leading-relaxed">
                {data.rawText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
