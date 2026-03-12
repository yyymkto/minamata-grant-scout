import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import type { AnyRecordDef } from "@shared/lib/record-def";
import { Panel } from "~/components/Panel";
import { DataTable } from "~/components/DataTable";
import { StatusFilterTabs } from "~/components/StatusFilterTabs";
import { SummaryCards } from "~/components/SummaryCards";

type Props<T extends Record<string, unknown>> = {
  def: AnyRecordDef;
  data: T[];
  isLoading: boolean;
};

export function RecordListPage<T extends Record<string, unknown>>({
  def,
  data,
  isLoading,
}: Props<T>) {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const columns = def.listView.columns.map((key) => {
    if (def.status && key === def.status.field) {
      return { key, label: def.status.label };
    }
    const field = def.fields[key];
    return { key, label: field?.label ?? key, field };
  });

  const filteredData = useMemo(() => {
    if (!statusFilter || !def.status) return data;
    return data.filter(
      (row) => row[def.status!.field] === statusFilter
    );
  }, [data, statusFilter, def.status]);

  const statusCounts = useMemo(() => {
    if (!def.status) return undefined;
    const counts: Record<string, number> = {};
    for (const opt of def.status.options) counts[opt] = 0;
    for (const row of data) {
      const val = String(row[def.status.field] ?? "");
      if (val in counts) counts[val]++;
    }
    return counts;
  }, [data, def.status]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">{def.label}</h1>
        <button
          type="button"
          onClick={() => navigate(`/${def.key}/new`)}
          className="rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950"
        >
          + New
        </button>
      </div>

      {def.status && statusCounts ? (
        <SummaryCards
          counts={statusCounts}
          options={def.status.options}
          onSelect={setStatusFilter}
          activeFilter={statusFilter}
        />
      ) : null}

      {def.status ? (
        <StatusFilterTabs
          options={def.status.options}
          current={statusFilter}
          onChange={setStatusFilter}
          counts={statusCounts}
        />
      ) : null}

      <Panel title="">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredData}
            status={def.status}
            onRowClick={(row) => navigate(`/${def.key}/${row.id}`)}
            caption={`${def.label} list`}
            emptyMessage={statusFilter ? "No records match this filter" : "No records yet"}
            emptyActionLabel={statusFilter ? undefined : "+ New"}
            onEmptyAction={statusFilter ? undefined : () => navigate(`/${def.key}/new`)}
            sortable
            defaultSort={def.listView.defaultSort}
          />
        )}
      </Panel>
    </div>
  );
}
