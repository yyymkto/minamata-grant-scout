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

function formatDeadline(deadline: string | null) {
  if (!deadline) return "未定";
  const d = new Date(deadline);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = `${d.getMonth() + 1}/${d.getDate()}`;
  if (diff < 0) return `${formatted} (終了)`;
  if (diff <= 7) return `${formatted} (残${diff}日)`;
  return formatted;
}

export function GrantListPage() {
  const [rank, setRank] = useState("");
  const [ministry, setMinistry] = useState("");
  const [department, setDepartment] = useState("");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
        {RANKS.map((r) => (
          <button
            key={r}
            onClick={() => setRank(rank === r ? "" : r)}
            className={`rounded-xl p-3 text-left transition ${rank === r ? "bg-slate-700 ring-1 ring-slate-500" : "bg-slate-800/50 hover:bg-slate-800"}`}
          >
            <p className="text-2xl font-bold text-white tabular-nums">
              {r === "A" ? stats.a : r === "B" ? stats.b : stats.c}
            </p>
            <p className="text-xs text-slate-400">ランク {r}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={ministry}
          onChange={(e) => setMinistry(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <option value="">全省庁</option>
          {MINISTRIES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            検索
          </button>
        </form>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中...</p>
      ) : grants.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">該当する補助金がありません</p>
      ) : (
        <div className="space-y-2">
          {grants.map((g) => (
            <Link
              key={g.id}
              href={`/grants/${g.id}`}
              className="block rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${rankColor(g.taraFitRank)}`}>
                      {g.taraFitRank ?? "—"}
                    </span>
                    <span className="text-xs text-slate-500">{g.sourceMinistry}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-medium text-white leading-snug">
                    {g.title}
                  </h3>
                  {g.summaryShort && (
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">{g.summaryShort}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">締切</p>
                  <p className="text-sm font-medium text-white">{formatDeadline(g.deadline)}</p>
                  {g.suggestedDepartment && (
                    <p className="mt-1 text-xs text-indigo-400">{g.suggestedDepartment}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
