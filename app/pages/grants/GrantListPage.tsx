import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useGrants } from "../../hooks/useGrants";

const RANKS = ["A", "B", "C"] as const;

const MINISTRIES = [
  "農林水産省",
  "総務省",
  "経済産業省",
  "厚生労働省",
  "国土交通省",
  "環境省",
  "デジタル庁",
  "観光庁",
  "内閣府",
];

const DEPARTMENTS = [
  "総務課",
  "企画商工課",
  "財政課",
  "町民福祉課",
  "健康増進課",
  "環境水道課",
  "税務課",
  "農林水産課",
  "建設課",
];

function rankBadge(rank: string | null) {
  switch (rank) {
    case "A":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "B":
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    case "C":
      return "bg-slate-600/30 text-slate-400 border-slate-600/40";
    default:
      return "bg-slate-700/50 text-slate-500 border-slate-600/30";
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

type SortKey = "rank" | "score" | "deadline";

export function GrantListPage() {
  const [rank, setRank] = useState("");
  const [ministry, setMinistry] = useState("");
  const [department, setDepartment] = useState("");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("score");

  const { data: grants = [], isLoading } = useGrants({
    rank: rank || undefined,
    ministry: ministry || undefined,
    department: department || undefined,
    q: q || undefined,
  });

  const stats = useMemo(() => {
    const total = grants.length;
    const a = grants.filter((g) => g.taraFitRank === "A").length;
    const b = grants.filter((g) => g.taraFitRank === "B").length;
    const c = grants.filter((g) => g.taraFitRank === "C").length;
    return { total, a, b, c };
  }, [grants]);

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
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">
          補助金・公募一覧
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          国の制度を太良町に翻訳する
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={() => setRank("")}
          className={`rounded-xl p-3 text-left transition ${!rank ? "bg-slate-700 ring-1 ring-slate-500" : "bg-slate-800/50 hover:bg-slate-800"}`}
        >
          <p className="text-2xl font-bold text-white tabular-nums">{stats.total}</p>
          <p className="text-xs text-slate-400">全件</p>
        </button>
        {RANKS.map((r) => {
          const count = r === "A" ? stats.a : r === "B" ? stats.b : stats.c;
          const colors = r === "A" ? "text-emerald-400" : r === "B" ? "text-amber-400" : "text-slate-400";
          return (
            <button
              key={r}
              onClick={() => setRank(rank === r ? "" : r)}
              className={`rounded-xl p-3 text-left transition ${rank === r ? "bg-slate-700 ring-1 ring-slate-500" : "bg-slate-800/50 hover:bg-slate-800"}`}
            >
              <p className={`text-2xl font-bold tabular-nums ${colors}`}>{count}</p>
              <p className="text-xs text-slate-400">ランク {r}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={ministry}
          onChange={(e) => setMinistry(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <option value="">全省庁</option>
          {MINISTRIES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <option value="">全担当課</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
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
            className="w-48 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            検索
          </button>
        </form>

        <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <span>並び順:</span>
          {(["score", "rank", "deadline"] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`rounded px-2 py-1 transition ${sortBy === key ? "bg-slate-700 text-white" : "hover:text-slate-300"}`}
            >
              {key === "score" ? "スコア" : key === "rank" ? "ランク" : "締切"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中...</p>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">該当する補助金がありません</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/50">
          {/* Header */}
          <div className="grid grid-cols-[3rem_1fr_7rem_6rem_7rem] gap-0 border-b border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-400">
            <span className="text-center">適合</span>
            <span className="pl-2">補助金名</span>
            <span className="text-center">担当課</span>
            <span className="text-center">スコア</span>
            <span className="text-center">締切</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-800/80">
            {sorted.map((g) => {
              const dl = deadlineInfo(g.deadline);
              return (
                <Link
                  key={g.id}
                  href={`/grants/${g.id}`}
                  className={`grid grid-cols-[3rem_1fr_7rem_6rem_7rem] gap-0 border-l-2 px-3 py-2.5 transition hover:bg-slate-800/70 ${rankRowBorder(g.taraFitRank)} ${dl.ended ? "opacity-50" : ""}`}
                >
                  {/* Rank badge */}
                  <span className="flex items-center justify-center">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold border ${rankBadge(g.taraFitRank)}`}>
                      {g.taraFitRank ?? "—"}
                    </span>
                  </span>

                  {/* Title + summary + ministry */}
                  <div className="min-w-0 pl-2">
                    <p className="truncate text-sm font-medium text-white">{g.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{g.sourceMinistry}</span>
                      {g.summaryShort && (
                        <>
                          <span className="text-slate-700">|</span>
                          <span className="truncate">{g.summaryShort}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Department */}
                  <span className="flex items-center justify-center text-xs text-indigo-400">
                    {g.suggestedDepartment ?? "—"}
                  </span>

                  {/* Score */}
                  <span className="flex items-center justify-center">
                    {g.taraFitScore != null ? (
                      <span className="text-sm tabular-nums font-medium text-white">
                        {g.taraFitScore}
                        <span className="text-xs text-slate-500">点</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </span>

                  {/* Deadline */}
                  <span className="flex flex-col items-center justify-center text-xs">
                    <span className={dl.ended ? "text-slate-500 line-through" : dl.urgent ? "font-medium text-red-400" : "text-slate-300"}>
                      {dl.text}
                    </span>
                    {dl.days != null && !dl.ended && dl.days <= 30 && (
                      <span className={dl.urgent ? "text-red-400" : "text-slate-500"}>
                        残{dl.days}日
                      </span>
                    )}
                    {dl.ended && (
                      <span className="text-slate-600">終了</span>
                    )}
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
