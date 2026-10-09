/**
 * Payment status is a separate state machine from the order (brief §8.1, §9). An order can be
 * cancelled while its refund is still pending, and the customer sees both facts.
 */

export const PAYMENT_STATUSES = [
  "pending",
  "confirmed",
  "failed",
  "pay_at_pickup",
  "refund_initiated",
  "refund_completed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** `provider` means a verified, deduplicated provider callback or status query. */
export type PaymentActor = "provider" | "restaurant" | "platform_admin" | "system";

export const PAYMENT_TRANSITIONS: Readonly<
  Record<PaymentStatus, readonly { to: PaymentStatus; actors: readonly PaymentActor[] }[]>
> = {
  // A browser timeout is never a failure: only the provider moves a pending payment.
  pending: [
    { to: "confirmed", actors: ["provider"] },
    { to: "failed", actors: ["provider", "system"] },
  ],
  failed: [{ to: "pending", actors: ["system"] }],
  // Cash or counter payment recorded by staff when the customer collects.
  pay_at_pickup: [{ to: "confirmed", actors: ["restaurant", "platform_admin"] }],
  confirmed: [{ to: "refund_initiated", actors: ["system", "platform_admin"] }],
  refund_initiated: [{ to: "refund_completed", actors: ["provider", "platform_admin"] }],
  refund_completed: [],
};

export const PAYMENT_LABELS: Readonly<Record<PaymentStatus, string>> = {
  pending: "Payment pending",
  confirmed: "Payment confirmed",
  failed: "Payment failed",
  pay_at_pickup: "Pay at pickup",
  refund_initiated: "Refund initiated",
  refund_completed: "Refund completed",
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus, actor: PaymentActor) {
  return PAYMENT_TRANSITIONS[from].some((r) => r.to === to && r.actors.includes(actor));
}

/** Whether kitchen fulfilment may start (brief §8.1: no work on prepaid orders before payment). */
export function isFulfilmentAllowed(status: PaymentStatus): boolean {
  return status === "confirmed" || status === "pay_at_pickup";
}

/** A rejected or cancelled order needs a refund only if money was actually taken. */
export function needsRefund(status: PaymentStatus): boolean {
  return status === "confirmed";
}
