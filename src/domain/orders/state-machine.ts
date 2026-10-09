/**
 * The order lifecycle from the brief (§8.1). The database enforces the same table in
 * `public.order_status_transitions` and `public.transition_order()`; a database test checks
 * that the two stay identical.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "awaiting_restaurant",
  "accepted",
  "preparing",
  "ready_for_collection",
  "collected",
  "rejected",
  "cancelled",
  "expired",
  "failed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Who is asking for the change. `system` is server code acting on a verified event or timeout. */
export type OrderActor = "customer" | "restaurant" | "platform_admin" | "system";

export interface TransitionRule {
  to: OrderStatus;
  actors: readonly OrderActor[];
  /** A reason must be recorded (rejections, cancellations by staff, corrections). */
  requiresReason?: boolean;
  /** A confirmed ready-time estimate must be supplied. */
  requiresEta?: boolean;
}

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly TransitionRule[]>> = {
  pending_payment: [
    { to: "awaiting_restaurant", actors: ["system"] },
    { to: "cancelled", actors: ["customer", "system", "platform_admin"] },
    { to: "expired", actors: ["system"] },
    { to: "failed", actors: ["system"] },
  ],
  awaiting_restaurant: [
    { to: "accepted", actors: ["restaurant"], requiresEta: true },
    { to: "rejected", actors: ["restaurant", "platform_admin"], requiresReason: true },
    { to: "cancelled", actors: ["customer", "platform_admin"] },
    { to: "expired", actors: ["system"] },
  ],
  accepted: [
    { to: "preparing", actors: ["restaurant"] },
    { to: "ready_for_collection", actors: ["restaurant"] },
    { to: "cancelled", actors: ["restaurant", "platform_admin"], requiresReason: true },
  ],
  preparing: [
    { to: "ready_for_collection", actors: ["restaurant"] },
    { to: "cancelled", actors: ["restaurant", "platform_admin"], requiresReason: true },
  ],
  ready_for_collection: [
    { to: "collected", actors: ["restaurant"] },
    // Correction flow when staff marked an order ready by mistake.
    { to: "preparing", actors: ["restaurant", "platform_admin"], requiresReason: true },
  ],
  collected: [],
  rejected: [],
  cancelled: [],
  expired: [],
  failed: [],
};

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
  (s) => ORDER_TRANSITIONS[s].length === 0,
);

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

export function findRule(from: OrderStatus, to: OrderStatus): TransitionRule | undefined {
  return ORDER_TRANSITIONS[from].find((r) => r.to === to);
}

export function nextStatuses(from: OrderStatus, actor: OrderActor): OrderStatus[] {
  return ORDER_TRANSITIONS[from].filter((r) => r.actors.includes(actor)).map((r) => r.to);
}

export type TransitionCheck =
  | { ok: true; rule: TransitionRule }
  | {
      ok: false;
      code: "invalid_transition" | "actor_not_allowed" | "reason_required" | "eta_required";
      message: string;
    };

export interface TransitionInput {
  from: OrderStatus;
  to: OrderStatus;
  actor: OrderActor;
  reason?: string | null;
  etaAt?: Date | string | null;
}

export function checkTransition(input: TransitionInput): TransitionCheck {
  const rule = findRule(input.from, input.to);
  if (!rule) {
    return {
      ok: false,
      code: "invalid_transition",
      message: `An order cannot move from ${input.from} to ${input.to}.`,
    };
  }
  if (!rule.actors.includes(input.actor)) {
    return {
      ok: false,
      code: "actor_not_allowed",
      message: `A ${input.actor} cannot move an order from ${input.from} to ${input.to}.`,
    };
  }
  if (rule.requiresReason && !input.reason?.trim()) {
    return { ok: false, code: "reason_required", message: "Give a reason for this change." };
  }
  if (rule.requiresEta && !input.etaAt) {
    return { ok: false, code: "eta_required", message: "Confirm an estimated ready time." };
  }
  return { ok: true, rule };
}
