import type { ReactNode } from "react";
import { CUSTOMER_ORDER_LABELS, STAFF_ORDER_LABELS } from "@/domain/orders/labels";
import type { OrderStatus as OrderStatusValue } from "@/domain/orders/state-machine";
import {
  PAYMENT_LABELS,
  type PaymentStatus as PaymentStatusValue,
} from "@/domain/payments/state-machine";
import type { BusinessStatus as BusinessStatusValue } from "@/domain/restaurants/business-status";
import { cn } from "./cn";
import { Glyph, type GlyphName } from "./glyph";

export type Tone = "brand" | "amber" | "danger" | "neutral";
export type Form = "soft" | "outline" | "solid";

const TONE_FORM: Record<`${Tone}-${Form}`, string> = {
  "brand-soft": "bg-brand-soft text-brand-strong border-transparent",
  "brand-outline": "bg-surface-raised text-brand-strong border-brand",
  "brand-solid": "bg-brand text-on-brand border-transparent",
  "amber-soft": "bg-amber-soft text-amber-strong border-transparent",
  "amber-outline": "bg-surface-raised text-amber-strong border-amber",
  "amber-solid": "bg-amber-strong text-surface border-transparent",
  "danger-soft": "bg-danger-soft text-danger border-transparent",
  "danger-outline": "bg-surface-raised text-danger border-danger",
  "danger-solid": "bg-danger text-on-danger border-transparent",
  "neutral-soft": "bg-neutral-soft text-ink border-transparent",
  "neutral-outline": "bg-surface-raised text-ink-muted border-line-strong",
  "neutral-solid": "bg-ink text-surface border-transparent",
};

export interface PillProps {
  tone: Tone;
  form: Form;
  glyph: GlyphName;
  size?: "md" | "lg";
  detail?: string;
  className?: string;
  children: ReactNode;
}

/** A status pill: glyph + word + form. Fully rounded shapes are reserved for status. */
export function Pill({ tone, form, glyph, size = "md", detail, className, children }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-pill border font-sans font-bold",
        size === "lg" ? "min-h-9 pr-4 pl-3 text-label" : "min-h-7 pr-3 pl-2 text-small",
        TONE_FORM[`${tone}-${form}`],
        className,
      )}
    >
      <Glyph name={glyph} size={size === "lg" ? 18 : 16} />
      <span>{children}</span>
      {detail ? <span className="font-normal">· {detail}</span> : null}
    </span>
  );
}

type Look = { tone: Tone; form: Form; glyph: GlyphName };

export const ORDER_STATUS_LOOK: Record<OrderStatusValue, Look> = {
  pending_payment: { tone: "amber", form: "outline", glyph: "clock" },
  awaiting_restaurant: { tone: "amber", form: "soft", glyph: "clock" },
  accepted: { tone: "brand", form: "outline", glyph: "progress" },
  preparing: { tone: "brand", form: "soft", glyph: "progress" },
  ready_for_collection: { tone: "brand", form: "solid", glyph: "bell" },
  collected: { tone: "neutral", form: "soft", glyph: "check" },
  rejected: { tone: "danger", form: "soft", glyph: "cross" },
  cancelled: { tone: "danger", form: "outline", glyph: "cross" },
  expired: { tone: "neutral", form: "outline", glyph: "slash" },
  failed: { tone: "danger", form: "outline", glyph: "alert" },
};

export function OrderStatus({
  status,
  audience = "customer",
  size,
  detail,
  className,
}: {
  status: OrderStatusValue;
  audience?: "customer" | "staff";
  size?: "md" | "lg";
  detail?: string;
  className?: string;
}) {
  const labels = audience === "staff" ? STAFF_ORDER_LABELS : CUSTOMER_ORDER_LABELS;
  return (
    <Pill {...ORDER_STATUS_LOOK[status]} size={size} detail={detail} className={className}>
      {labels[status]}
    </Pill>
  );
}

const PAYMENT_LOOK: Record<PaymentStatusValue, Look> = {
  pending: { tone: "amber", form: "outline", glyph: "clock" },
  confirmed: { tone: "brand", form: "soft", glyph: "check" },
  failed: { tone: "danger", form: "soft", glyph: "cross" },
  pay_at_pickup: { tone: "neutral", form: "outline", glyph: "ring" },
  refund_initiated: { tone: "amber", form: "soft", glyph: "undo" },
  refund_completed: { tone: "neutral", form: "soft", glyph: "check" },
};

export function PaymentStatus({
  status,
  size,
  detail,
  className,
}: {
  status: PaymentStatusValue;
  size?: "md" | "lg";
  detail?: string;
  className?: string;
}) {
  return (
    <Pill {...PAYMENT_LOOK[status]} size={size} detail={detail} className={className}>
      {PAYMENT_LABELS[status]}
    </Pill>
  );
}

const BUSINESS_LOOK: Record<BusinessStatusValue, Look & { label: string }> = {
  open: { tone: "brand", form: "soft", glyph: "dot", label: "Open" },
  paused: { tone: "amber", form: "soft", glyph: "pause", label: "Paused" },
  closed: { tone: "neutral", form: "outline", glyph: "slash", label: "Closed" },
};

export function BusinessStatus({
  status,
  size,
  detail,
  className,
}: {
  status: BusinessStatusValue;
  size?: "md" | "lg";
  detail?: string;
  className?: string;
}) {
  const { label, ...look } = BUSINESS_LOOK[status];
  return (
    <Pill {...look} size={size} detail={detail} className={className}>
      {label}
    </Pill>
  );
}
