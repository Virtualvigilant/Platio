import { cn } from "./cn";

/** The customer's pickup code, framed for the counter. Without a code it shows when it will appear. */
export function PickupCode({
  code,
  orderNumber,
  restaurant,
  hint = "Show this code at the counter when you collect.",
  lockedHint = "Your pickup code appears here once the restaurant accepts your order.",
  className,
}: {
  code?: string | null;
  orderNumber?: string | number;
  restaurant?: string;
  hint?: string;
  lockedHint?: string;
  className?: string;
}) {
  const locked = !code;
  return (
    <section
      aria-label="Pickup code"
      className={cn(
        "flex flex-col items-center gap-2 rounded-md border-2 bg-surface-raised px-4 py-6 text-center",
        locked ? "border-dashed border-line-strong" : "border-brand",
        className,
      )}
    >
      <span className="font-serif text-eyebrow text-brand-strong uppercase">Pickup code</span>
      <span
        aria-hidden={locked || undefined}
        className={cn(
          "pl-[0.12em] font-sans text-pickup-code tabular-nums",
          locked ? "text-line-strong" : "text-ink",
        )}
      >
        {locked ? "····" : code}
      </span>
      {orderNumber || restaurant ? (
        <span className="font-sans text-ui text-ink">
          {orderNumber ? <span className="tabular-nums">Order #{orderNumber}</span> : null}
          {orderNumber && restaurant ? " · " : null}
          {restaurant}
        </span>
      ) : null}
      <p className="m-0 max-w-[32ch] font-serif text-body-sm text-ink-muted">
        {locked ? lockedHint : hint}
      </p>
    </section>
  );
}
