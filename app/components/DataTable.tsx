import { useState, useMemo, useCallback } from "react";
import type { FieldDef, StatusDef } from "@shared/lib/record-def";
import { StatusBadge } from "./StatusBadge";

type Column = {
  key: string;
  label: string;
  field?: FieldDef;
};

type SortState = {
  field: string;
  direction: "asc" | "desc";
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  status,
  onRowClick,
  caption,
  emptyMessage = "No records yet",
  emptyActionLabel,
  onEmptyAction,
  sortable = false,
  defaultSort,
}: {
  columns: Column[];
  rows: T[];
  status?: StatusDef;
  onRowClick?: (row: T) => void;
  caption?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  sortable?: boolean;
  defaultSort?: SortState;
}) {
  const [sort, setSort] = useState<SortState | undefined>(defaultSort);

  const handleSort = useCallback(
    (field: string) => {
      if (!sortable) return;
      setSort((prev) => {
        if (prev?.field === field) {
          return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
        }
        return { field, direction: "asc" };
      });
    },
    [sortable],
  );

  const sortedRows = useMemo(() => {
    if (!sortable || !sort) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sort.field];
      const bVal = b[sort.field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [rows, sort, sortable]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-[0.2em] text-slate-300">
            {columns.map((col) => {
              const isActive = sort?.field === col.key;
              const ariaSortAttr = sortable
                ? isActive
                  ? sort.direction === "asc"
                    ? ("ascending" as const)
                    : ("descending" as const)
                  : ("none" as const)
                : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 font-medium"
                  aria-sort={ariaSortAttr}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center bg-transparent border-none p-0 font-inherit text-inherit cursor-pointer select-none"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      {isActive && (
                        <span className="ml-1" aria-hidden="true">
                          {sort.direction === "asc" ? "▲" : "▼"}
                        </span>
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center"
              >
                <p className="text-slate-400">{emptyMessage}</p>
                {onEmptyAction && emptyActionLabel && (
                  <button
                    type="button"
                    onClick={onEmptyAction}
                    className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950"
                  >
                    {emptyActionLabel}
                  </button>
                )}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={(row.id as number) ?? i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-white/5 ${
                  onRowClick
                    ? "cursor-pointer hover:bg-white/5 transition"
                    : ""
                }`}
                {...(onRowClick
                  ? {
                      tabIndex: 0,
                      "aria-label": String(
                        row[columns[0]?.key] ?? `Row ${i + 1}`,
                      ),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      },
                    }
                  : {})}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-200">
                    {status && col.key === status.field ? (
                      <StatusBadge
                        value={String(row[col.key] ?? "")}
                        options={status.options}
                      />
                    ) : (
                      String(row[col.key] ?? "")
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
