import { describe, expect, it } from "vitest";
import {
  PAYMENT_STATUSES,
  PAYMENT_TRANSITIONS,
  canTransitionPayment,
  isFulfilmentAllowed,
  needsRefund,
} from "./state-machine";

describe("payment state machine", () => {
  it("only targets known statuses", () => {
    for (const s of PAYMENT_STATUSES) {
      for (const r of PAYMENT_TRANSITIONS[s]) expect(PAYMENT_STATUSES).toContain(r.to);
    }
  });

  it("confirms a pending payment only from a verified provider event", () => {
    expect(canTransitionPayment("pending", "confirmed", "provider")).toBe(true);
    expect(canTransitionPayment("pending", "confirmed", "system")).toBe(false);
    expect(canTransitionPayment("pending", "confirmed", "restaurant")).toBe(false);
  });

  it("lets staff record a pay-at-pickup payment", () => {
    expect(canTransitionPayment("pay_at_pickup", "confirmed", "restaurant")).toBe(true);
  });

  it("goes through refund_initiated before refund_completed", () => {
    expect(canTransitionPayment("confirmed", "refund_completed", "provider")).toBe(false);
    expect(canTransitionPayment("confirmed", "refund_initiated", "system")).toBe(true);
    expect(canTransitionPayment("refund_initiated", "refund_completed", "provider")).toBe(true);
  });

  it("allows kitchen work only once payment is settled or deferred to pickup", () => {
    expect(isFulfilmentAllowed("pending")).toBe(false);
    expect(isFulfilmentAllowed("failed")).toBe(false);
    expect(isFulfilmentAllowed("confirmed")).toBe(true);
    expect(isFulfilmentAllowed("pay_at_pickup")).toBe(true);
  });

  it("refunds only money that was taken", () => {
    expect(needsRefund("confirmed")).toBe(true);
    expect(needsRefund("pay_at_pickup")).toBe(false);
    expect(needsRefund("pending")).toBe(false);
  });
});
