import type { ReactNode } from "react";
import type { OrderStatus as OrderStatusValue } from "@/domain/orders/state-machine";
import type { PaymentStatus as PaymentStatusValue } from "@/domain/payments/state-machine";
import { cn } from "./cn";
import { Glyph } from "./glyph";
import { OrderStatus, PaymentStatus, Pill } from "./status";

export interface TicketItem {
  qty: number;
  name: string;
  /** Chosen modifiers as one line, e.g. "Large · extra kachumbari". */
  options?: string;
}

/** One order in the kitchen queue, readable at arm's length, with its next actions in a slot. */
export function OrderTicket({
  number,
  status,
  items,
  receivedAt,
  ageMinutes,
  mode,
  payment,
  note,
  eta,
  isNew,
  actions,
  className,
}: {
  number: string | number;
  status: OrderStatusValue;
  items: readonly TicketItem[];
  receivedAt?: string;
  ageMinutes?: number;
  mode?: "pickup" | "dine_in";
  payment?: PaymentStatusValue;
  note?: string | null;
  eta?: string | null;
  /** Unacknowledged new order: amber header and a "New" flag. */
  isNew?: boolean;
  /** Large buttons for the next step, e.g. Reject and Accept. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <article
      aria-label={`Order ${number}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-md border border-line bg-surface-raised font-sans text-ink",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3",
          isNew ? "border-b-2 border-amber bg-amber-soft text-ink" : "bg-navy text-on-navy",
        )}
      >
        <div>
          {isNew ? (
            <span className="mr-2 inline-flex items-center gap-1 rounded-pill bg-amber-strong px-2 py-0.5 align-middle text-small font-bold text-surface">
              <Glyph name="bell" size={14} />
              New
            </span>
          ) : null}
          <span className="text-numeral tabular-nums">#{number}</span>
        </div>
        <div className="text-right text-small">
          {ageMinutes != null ? (
            <strong className="block text-[20px] leading-6 tabular-nums">{ageMinutes} min</strong>
          ) : null}
          {receivedAt ? `Received ${receivedAt}` : null}
        </div>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <OrderStatus status={status} audience="staff" />
          {payment ? <PaymentStatus status={payment} /> : null}
          {mode ? (
            <Pill tone="neutral" form="outline" glyph="ring">
              {mode === "pickup" ? "Pickup" : "Dine-in"}
            </Pill>
          ) : null}
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((it, i) => (
            <li
              key={i}
              className="grid grid-cols-[40px_minmax(0,1fr)] gap-2 text-[18px] leading-[22px]"
            >
              <span className="font-bold tabular-nums">{it.qty}×</span>
              <span>
                {it.name}
                {it.options ? (
                  <span className="block text-small text-ink-muted">{it.options}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {note ? (
          <p className="m-0 bg-surface-alt px-3 py-2 font-serif text-body-sm">
            <b className="font-sans">Note: </b>
            {note}
          </p>
        ) : null}
        {eta ? (
          <div className="text-ui">
            Ready by <span className="font-bold tabular-nums">{eta}</span>
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 px-4 pb-4">
          {actions}
        </div>
      ) : null}
    </article>
  );
}
