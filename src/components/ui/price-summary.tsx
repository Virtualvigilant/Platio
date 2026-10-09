import type { ReactNode } from "react";
import { formatKES } from "@/domain/money";
import { cn } from "./cn";

export interface PriceLine {
  label: ReactNode;
  amountMinor: number;
  hint?: ReactNode;
}

/** Subtotal and every fee, then the server-calculated total. Never sum in the browser. */
export function PriceSummary({
  lines,
  totalMinor,
  totalLabel = "Total",
  footnote,
  className,
}: {
  lines: readonly PriceLine[];
  totalMinor: number;
  totalLabel?: string;
  footnote?: ReactNode;
  className?: string;
}) {
  const row = "grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2";
  return (
    <div className={className}>
      <dl className="m-0 font-sans text-ui text-ink">
        {lines.map((l, i) => (
          <div key={i} className={row}>
            <dt className="min-w-0">
              {l.label}
              {l.hint ? (
                <span className="block font-serif text-body-sm text-ink-muted">{l.hint}</span>
              ) : null}
            </dt>
            <dd className="m-0 text-right tabular-nums">{formatKES(l.amountMinor)}</dd>
          </div>
        ))}
        <div
          className={cn(row, "mt-2 border-t border-ink pt-3 text-[20px] leading-[26px] font-bold")}
        >
          <dt>{totalLabel}</dt>
          <dd className="m-0 text-right tabular-nums">{formatKES(totalMinor)}</dd>
        </div>
      </dl>
      {footnote ? (
        <p className="mt-2 mb-0 font-serif text-body-sm text-ink-muted">{footnote}</p>
      ) : null}
    </div>
  );
}
