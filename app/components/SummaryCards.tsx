type Props = {
  counts: Record<string, number>;
  options: readonly string[];
  onSelect: (status: string | null) => void;
  activeFilter: string | null;
};

export function SummaryCards({ counts, options, onSelect, activeFilter }: Props) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex-1 min-w-[120px] rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10 ${
          activeFilter === null ? "ring-2 ring-amber-400/60" : ""
        }`}
      >
        <p className="text-sm text-slate-400">All</p>
        <p className="text-2xl font-bold tabular-nums text-white">{total}</p>
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect(activeFilter === opt ? null : opt)}
          className={`flex-1 min-w-[120px] rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10 ${
            activeFilter === opt ? "ring-2 ring-amber-400/60" : ""
          }`}
        >
          <p className="text-sm text-slate-400">{opt}</p>
          <p className="text-2xl font-bold tabular-nums text-white">{counts[opt] ?? 0}</p>
        </button>
      ))}
    </div>
  );
}
