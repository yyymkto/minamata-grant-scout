const FALLBACK_COLORS: string[] = [
  "bg-sky-400/15 text-sky-200",
  "bg-amber-400/15 text-amber-200",
  "bg-emerald-400/15 text-emerald-200",
  "bg-rose-400/15 text-rose-200",
  "bg-fuchsia-400/15 text-fuchsia-200",
  "bg-cyan-400/15 text-cyan-200",
];

const statusColorMap: { pattern: RegExp; color: string }[] = [
  { pattern: /受付|\b(new|open|pending)\b/i, color: "bg-sky-400/15 text-sky-200" },
  {
    pattern: /進行|配車|\b(active|in.progress|processing)\b/i,
    color: "bg-amber-400/15 text-amber-200",
  },
  {
    pattern: /完了|\b(done|complete|closed|resolved)\b/i,
    color: "bg-emerald-400/15 text-emerald-200",
  },
  {
    pattern: /取消|\b(cancel|reject|error|fail)\b/i,
    color: "bg-rose-400/15 text-rose-200",
  },
  {
    pattern: /保留|\b(hold|pause|wait)\b/i,
    color: "bg-slate-400/15 text-slate-200",
  },
];

function getStatusColor(value: string, index: number): string {
  if (!value) return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  for (const entry of statusColorMap) {
    if (entry.pattern.test(value)) {
      return entry.color;
    }
  }
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function StatusBadge({
  value,
  options,
}: {
  value: string;
  options: readonly string[];
}) {
  const idx = options.indexOf(value);
  const color = getStatusColor(value, idx >= 0 ? idx : 0);
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${color}`}
    >
      {value}
    </span>
  );
}
