import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useGrants } from "../../hooks/useGrants";

const CATEGORIES = [
  { key: "農業", label: "農業" },
  { key: "漁業", label: "漁業" },
  { key: "林業", label: "林業" },
  { key: "旅館・観光", label: "旅館・観光" },
  { key: "小規模事業者", label: "小規模事業者" },
  { key: "インフラ・建設", label: "インフラ・建設" },
  { key: "福祉・医療", label: "福祉・医療" },
  { key: "環境・エネルギー", label: "環境・エネルギー" },
  { key: "デジタル・IT", label: "デジタル・IT" },
  { key: "地域振興", label: "地域振興" },
];

function rankBadge(rank: string | null) {
  switch (rank) {
    case "A":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "B":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "C":
      return "bg-gray-100 text-gray-500 border-gray-300";
    default:
      return "bg-gray-100 text-gray-400 border-gray-300";
  }
}

function rankRowBorder(rank: string | null) {
  switch (rank) {
    case "A":
      return "border-l-emerald-500";
    case "B":
      return "border-l-amber-500";
    default:
      return "border-l-transparent";
  }
}

function deadlineInfo(deadline: string | null) {
  if (!deadline) return { text: "未定", urgent: false, ended: false };
  const d = new Date(deadline);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  if (diff < 0) return { text: formatted, urgent: false, ended: true, days: diff };
  if (diff <= 7) return { text: formatted, urgent: true, ended: false, days: diff };
  if (diff <= 30) return { text: formatted, urgent: false, ended: false, days: diff };
  return { text: formatted, urgent: false, ended: false, days: diff };
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="h-7 w-7 rounded bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
      <div className="h-4 w-10 rounded bg-gray-100" />
      <div className="h-4 w-16 rounded bg-gray-100" />
    </div>
  );
}

type SortKey = "rank" | "score" | "deadline";

export function GrantListPage() {
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [showEnded, setShowEnded] = useState(false);

  const { data: grants = [], isLoading } = useGrants({
    category: category || undefined,
    q: q || undefined,
    includeEnded: showEnded,
  });

  const sorted = useMemo(() => {
    const rankOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
    return [...grants].sort((a, b) => {
      if (sortBy === "rank") {
        const ra = rankOrder[a.taraFitRank ?? "C"] ?? 3;
        const rb = rankOrder[b.taraFitRank ?? "C"] ?? 3;
        if (ra !== rb) return ra - rb;
        return (b.taraFitScore ?? 0) - (a.taraFitScore ?? 0);
      }
      if (sortBy === "score") {
        return (b.taraFitScore ?? 0) - (a.taraFitScore ?? 0);
      }
      // deadline
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }, [grants, sortBy]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">
          補助金スカウト <span className="text-lg font-normal text-gray-400">@太良</span> <span className="text-base font-normal text-gray-400">— </span><span className="text-indigo-600">{grants.length}</span><span className="text-base font-normal text-gray-400">件</span>
        </h1>
        <p className="text-xs text-gray-400">
          AIが太良町との相性を判定
        </p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <button
          onClick={() => setCategory("")}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${!category ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:text-gray-900"}`}
        >
          すべて
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(category === cat.key ? "" : cat.key)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${category === cat.key ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:text-gray-900"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search & sort */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(searchInput);
          }}
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="キーワード検索..."
            className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:w-48"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-500 active:scale-95"
          >
            検索
          </button>
        </form>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-gray-600 sm:gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-gray-900">
            <input
              type="checkbox"
              checked={showEnded}
              onChange={(e) => setShowEnded(e.target.checked)}
              className="cursor-pointer rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
            />
            終了分も表示
          </label>
          <span className="hidden text-gray-300 sm:inline">|</span>
          <div className="flex items-center gap-1">
            <span className="hidden sm:inline">並び順:</span>
            {(["score", "rank", "deadline"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`cursor-pointer rounded px-2 py-1 transition-all duration-200 ${sortBy === key ? "bg-gray-900 text-white" : "hover:bg-gray-200 hover:text-gray-900"}`}
              >
                {key === "score" ? "スコア" : key === "rank" ? "ランク" : "締切"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <span className="text-3xl text-gray-300">&#128269;</span>
          <p className="text-sm text-gray-600">該当する補助金がありません</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Rows */}
          <div className="divide-y divide-gray-200">
            {sorted.map((g) => {
              const dl = deadlineInfo(g.deadline);
              return (
                <Link
                  key={g.id}
                  href={`/grants/${g.id}`}
                  className={`group flex cursor-pointer items-start gap-3 border-l-3 px-4 py-3.5 transition-all duration-200 hover:bg-indigo-50/50 sm:items-center ${rankRowBorder(g.taraFitRank)} ${dl.ended ? "opacity-50" : ""}`}
                >
                  {/* Rank badge */}
                  <span className="flex shrink-0 items-center pt-0.5 sm:pt-0">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold border transition-transform duration-200 group-hover:scale-110 ${rankBadge(g.taraFitRank)}`}>
                      {g.taraFitRank ?? "—"}
                    </span>
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-gray-900 group-hover:text-indigo-700 transition-colors duration-200 sm:truncate">
                      {g.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span className="font-medium">{g.sourceMinistry}</span>
                      {g.taraFitScore != null && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="tabular-nums font-semibold text-gray-700">{g.taraFitScore}点</span>
                        </>
                      )}
                      {g.maxAmount && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="font-semibold text-emerald-700">{g.maxAmount}</span>
                        </>
                      )}
                      {dl.text !== "未定" && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className={dl.ended ? "text-gray-400 line-through" : dl.urgent ? "font-semibold text-red-600" : "text-gray-600"}>
                            {dl.ended ? "終了" : dl.days != null && dl.days <= 30 ? `残${dl.days}日` : `〜${dl.text}`}
                          </span>
                        </>
                      )}
                    </div>
                    {g.summaryShort && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 sm:line-clamp-1">
                        {g.summaryShort}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <span className="hidden shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500 sm:block" aria-hidden="true">
                    ›
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
