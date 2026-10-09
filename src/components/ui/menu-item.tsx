import type { ReactNode } from "react";
import { formatKES } from "@/domain/money";
import { cn } from "./cn";
import { Pill } from "./status";

/** One dish: name, description, KES price, prep time, labels and an action slot. */
export function MenuItem({
  name,
  description,
  priceMinor,
  prepMinutes,
  tags = [],
  imageUrl,
  imageAlt = "",
  available = true,
  unavailableLabel = "Unavailable",
  action,
  className,
}: {
  name: string;
  description?: string | null;
  priceMinor: number;
  prepMinutes?: number | null;
  tags?: readonly string[];
  imageUrl?: string | null;
  imageAlt?: string;
  available?: boolean;
  unavailableLabel?: string;
  /** e.g. an "Add" button. Omitted for unavailable items. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line py-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h3
          className={cn(
            "m-0 font-sans text-[18px] leading-[22px] font-bold",
            available ? "text-ink" : "text-ink-muted",
          )}
        >
          {name}
        </h3>
        {description ? (
          <p className="m-0 font-serif text-body-sm text-ink-muted">{description}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-ui text-ink">
          <span
            className={cn("font-bold tabular-nums", !available && "text-ink-muted line-through")}
          >
            {formatKES(priceMinor)}
          </span>
          {prepMinutes ? (
            <span className="text-small text-ink-muted">
              About <span className="tabular-nums">{prepMinutes}</span> min
            </span>
          ) : null}
          {tags.map((t) => (
            <span key={t} className="rounded-sm border border-line-strong px-2 py-px text-small">
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- storage URLs are already sized
          <img
            src={imageUrl}
            alt={imageAlt}
            className="size-24 rounded-md bg-surface-alt object-cover"
          />
        ) : null}
        {available ? (
          action
        ) : (
          <Pill tone="neutral" form="soft" glyph="slash">
            {unavailableLabel}
          </Pill>
        )}
      </div>
    </article>
  );
}
