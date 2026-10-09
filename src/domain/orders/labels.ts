import type { OrderStatus } from "./state-machine";

/** Wording from the brief's tracking timeline (§5.5) and copy rules (§13.2). */
export const CUSTOMER_ORDER_LABELS: Readonly<Record<OrderStatus, string>> = {
  pending_payment: "Confirming payment",
  awaiting_restaurant: "Awaiting restaurant confirmation",
  accepted: "Accepted",
  preparing: "Preparing",
  ready_for_collection: "Ready for collection",
  collected: "Collected",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
  failed: "Failed",
};

/** Staff wording names the job rather than the system state. */
export const STAFF_ORDER_LABELS: Readonly<Record<OrderStatus, string>> = {
  ...CUSTOMER_ORDER_LABELS,
  pending_payment: "Awaiting payment",
  awaiting_restaurant: "New order",
};

/** Steps of the customer timeline, in order. */
export const TIMELINE_STEPS = [
  { key: "received", label: "Order received" },
  { key: "awaiting_restaurant", label: "Awaiting restaurant confirmation" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready_for_collection", label: "Ready for collection" },
  { key: "collected", label: "Collected" },
] as const;

export const TIMELINE_INDEX: Partial<Record<OrderStatus, number>> = {
  pending_payment: 0,
  awaiting_restaurant: 1,
  accepted: 2,
  preparing: 3,
  ready_for_collection: 4,
  collected: 5,
};
