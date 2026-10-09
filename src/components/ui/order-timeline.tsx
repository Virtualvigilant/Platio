import { TIMELINE_INDEX, TIMELINE_STEPS } from "@/domain/orders/labels";
import type { OrderStatus } from "@/domain/orders/state-machine";
import { cn } from "./cn";
import { Glyph } from "./glyph";

const STOPPED: Partial<Record<OrderStatus, string>> = {
  rejected: "Rejected by the restaurant",
  cancelled: "Cancelled",
  expired: "Expired",
  failed: "Failed",
};

function EtaBlock({ label, value, note }: { label: string; value?: string; note?: string }) {
  return (
    <div className="mb-4 rounded-0 bg-surface-alt px-4 py-3 font-sans">
      <span className="block text-small text-ink-muted">{label}</span>
      {value ? <span className="block text-numeral text-ink tabular-nums">{value}</span> : null}
      {note ? <span className="block font-serif text-body-sm text-ink-muted">{note}</span> : null}
    </div>
  );
}

/** The customer's live tracking view: estimate first, then each step with its local time. */
export function OrderTimeline({
  status,
  times = {},
  eta,
  pickupNote,
  stoppedAfter = 1,
  stopReason,
  className,
}: {
  status: OrderStatus;
  times?: Partial<Record<string, string>>;
  eta?: { time: string; updatedAt?: string; reason?: string };
  pickupNote?: string;
  stoppedAfter?: number;
  stopReason?: string;
  className?: string;
}) {
  const stopped = status in STOPPED;
  const finished = status === "collected";
  const current = stopped ? stoppedAfter : (TIMELINE_INDEX[status] ?? 0);

  let etaBlock = null;
  if (!stopped && !finished) {
    if (status === "ready_for_collection") {
      etaBlock = <EtaBlock label="Your order is ready" value="Collect now" note={pickupNote} />;
    } else if (eta && (status === "accepted" || status === "preparing")) {
      const note = [eta.updatedAt && `Updated ${eta.updatedAt}`, eta.reason]
        .filter(Boolean)
        .join(". ");
      etaBlock = (
        <EtaBlock label="Estimated ready time" value={eta.time} note={note || undefined} />
      );
    } else {
      etaBlock = (
        <EtaBlock
          label="Estimated ready time"
          note={
            status === "pending_payment"
              ? "We’re confirming your payment. Don’t place the order again yet."
              : "Waiting for restaurant to confirm preparation time."
          }
        />
      );
    }
  }

  const steps = TIMELINE_STEPS.filter((_, i) => !stopped || i <= current);

  return (
    <div className={className}>
      {etaBlock}
      <ol className="m-0 list-none p-0 font-sans">
        {steps.map((s, i) => {
          const done = finished || i < current;
          const isCurrent = !finished && !stopped && i === current;
          const isLast = i === steps.length - 1 && !stopped;
          return (
            <li
              key={s.key}
              aria-current={isCurrent ? "step" : undefined}
              className="relative grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 pb-4 last:pb-0"
            >
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-6 bottom-0 left-[11px] w-0.5",
                    done ? "bg-brand" : "bg-line",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border-2 text-on-brand",
                  done && "border-brand bg-brand",
                  isCurrent &&
                    "border-brand bg-surface-raised shadow-[0_0_0_4px_var(--color-brand-soft)]",
                  !done && !isCurrent && "border-line-strong bg-surface-raised",
                )}
              >
                {done ? <Glyph name="check" size={14} /> : null}
                {isCurrent ? <span className="size-2.5 rounded-full bg-brand" /> : null}
              </span>
              <span
                className={cn(
                  "text-ui leading-6",
                  done && "text-ink",
                  isCurrent && "font-bold text-ink",
                  !done && !isCurrent && "text-ink-muted",
                )}
              >
                {s.label}
                {done ? <span className="sr-only"> (done)</span> : null}
              </span>
              <span className="text-small leading-6 text-ink-muted tabular-nums">
                {times[s.key] ?? ""}
              </span>
            </li>
          );
        })}
        {stopped ? (
          <li
            aria-current="step"
            className="relative grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3"
          >
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-danger bg-danger text-on-danger">
              <Glyph name="cross" size={14} />
            </span>
            <span className="text-ui leading-6 font-bold text-ink">
              {STOPPED[status]}
              {stopReason ? (
                <span className="block font-serif text-body-sm font-normal text-ink-muted">
                  {stopReason}
                </span>
              ) : null}
            </span>
            <span className="text-small leading-6 text-ink-muted tabular-nums">
              {times[status] ?? ""}
            </span>
          </li>
        ) : null}
      </ol>
    </div>
  );
}
