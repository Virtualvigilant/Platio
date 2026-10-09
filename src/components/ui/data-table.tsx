import type { ReactNode } from "react";
import { cn } from "./cn";

export interface DataColumn<Row> {
  key: string;
  label: ReactNode;
  /** Right-aligned, sans, tabular figures. */
  numeric?: boolean;
  render?: (row: Row) => ReactNode;
}

/** The brief's table: navy header, black hairline rules, zebra rows. Scrolls inside its own box. */
export function DataTable<Row extends { id?: string | number }>({
  columns,
  rows,
  caption,
  rowHeaders,
  empty = "Nothing to show yet.",
  className,
}: {
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  caption?: ReactNode;
  rowHeaders?: boolean;
  empty?: ReactNode;
  className?: string;
}) {
  const cell = "border px-3 py-2 align-top";
  const align = (numeric?: boolean) =>
    numeric ? "text-right font-sans tabular-nums whitespace-nowrap" : "text-left";
  return (
    <div className={cn("max-w-full overflow-x-auto", className)} tabIndex={0}>
      <table className="w-full border-collapse bg-surface font-serif text-body-sm text-ink">
        {caption ? (
          <caption className="caption-top pb-2 text-left font-sans text-heading text-brand">
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  cell,
                  "border-navy border-b-[3px] border-b-surface border-double bg-navy font-bold text-on-navy",
                  align(c.numeric),
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={r.id ?? i} className="even:bg-surface-alt">
                {columns.map((c, j) => {
                  const value = c.render
                    ? c.render(r)
                    : ((r as Record<string, ReactNode>)[c.key] ?? null);
                  return j === 0 && rowHeaders ? (
                    <th
                      key={c.key}
                      scope="row"
                      className={cn(cell, "border-rule text-left font-normal")}
                    >
                      {value}
                    </th>
                  ) : (
                    <td key={c.key} className={cn(cell, "border-rule", align(c.numeric))}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length || 1}
                className="border border-rule px-3 py-6 text-center text-ink-muted"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
