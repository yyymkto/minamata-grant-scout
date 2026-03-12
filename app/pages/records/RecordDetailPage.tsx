import { useLocation } from "wouter";
import type { AnyRecordDef, FieldDef } from "@shared/lib/record-def";
import { Panel } from "~/components/Panel";
import { StatusBadge } from "~/components/StatusBadge";

type Props<T extends Record<string, unknown>> = {
  def: AnyRecordDef;
  data: T | undefined;
  isLoading: boolean;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
  isDeleting?: boolean;
  /** Map from relation field key to a lookup of id → display label */
  relationLabels?: Record<string, Record<number, string>>;
};

export function RecordDetailPage<T extends Record<string, unknown>>({
  def,
  data,
  isLoading,
  onDelete,
  onStatusChange,
  isDeleting,
  relationLabels = {},
}: Props<T>) {
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Panel title={def.label}>
          <p className="text-sm text-slate-400">Loading...</p>
        </Panel>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Panel title={def.label}>
          <p className="text-sm text-rose-300">Not found</p>
        </Panel>
      </div>
    );
  }

  const id = data.id as number;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(`/${def.key}`)}
            className="text-sm text-slate-400 hover:text-white"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-semibold text-white">
            {def.label} #{id}
          </h1>
          {def.status ? (
            <StatusBadge
              value={String(data[def.status.field] ?? "")}
              options={def.status.options}
            />
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/${def.key}/${id}/edit`)}
            className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"
          >
            Edit
          </button>
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this record?")) {
                  onDelete();
                }
              }}
              disabled={isDeleting}
              className="rounded-xl bg-rose-500/10 px-4 py-3 font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      <Panel title="Details">
        <dl className="grid gap-4 sm:grid-cols-2">
          {(Object.entries(def.fields) as [string, FieldDef][]).map(([key, field]) => {
            let displayValue: string;
            if (data[key] == null) {
              displayValue = "-";
            } else if (
              field.type === "relation" &&
              relationLabels[key] &&
              typeof data[key] === "number"
            ) {
              displayValue =
                relationLabels[key][data[key] as number] ??
                String(data[key]);
            } else {
              displayValue = String(data[key]);
            }
            return (
              <div key={key}>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {field.label}
                </dt>
                <dd className="mt-1 text-sm text-slate-200">
                  {displayValue}
                </dd>
              </div>
            );
          })}
        </dl>
      </Panel>

      {def.status && onStatusChange ? (
        <Panel title="Status">
          <div className="flex flex-wrap gap-2">
            {(def.status.options as readonly string[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onStatusChange(opt)}
                disabled={data[def.status!.field] === opt}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  data[def.status!.field] === opt
                    ? "bg-amber-400 text-slate-950"
                    : "bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-30"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="Metadata">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Created
            </dt>
            <dd className="mt-1 text-sm text-slate-200">
              {String(data.createdAt ?? "-")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Updated
            </dt>
            <dd className="mt-1 text-sm text-slate-200">
              {String(data.updatedAt ?? "-")}
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  );
}
