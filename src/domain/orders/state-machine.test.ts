import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  TERMINAL_ORDER_STATUSES,
  checkTransition,
  isTerminal,
  nextStatuses,
} from "./state-machine";
import { CUSTOMER_ORDER_LABELS, STAFF_ORDER_LABELS } from "./labels";

describe("order state machine", () => {
  it("has a rule list for every status and only targets known statuses", () => {
    for (const status of ORDER_STATUSES) {
      for (const rule of ORDER_TRANSITIONS[status]) {
        expect(ORDER_STATUSES).toContain(rule.to);
        expect(rule.to).not.toBe(status);
      }
    }
  });

  it("treats collected, rejected, cancelled, expired and failed as terminal", () => {
    expect([...TERMINAL_ORDER_STATUSES].sort()).toEqual(
      ["cancelled", "collected", "expired", "failed", "rejected"].sort(),
    );
    expect(isTerminal("preparing")).toBe(false);
  });

  it("only lets verified system events release a prepaid order to the kitchen", () => {
    expect(nextStatuses("pending_payment", "restaurant")).toEqual([]);
    expect(nextStatuses("pending_payment", "customer")).toEqual(["cancelled"]);
    expect(
      checkTransition({ from: "pending_payment", to: "awaiting_restaurant", actor: "customer" }),
    ).toMatchObject({ ok: false, code: "actor_not_allowed" });
    expect(
      checkTransition({ from: "pending_payment", to: "awaiting_restaurant", actor: "system" }).ok,
    ).toBe(true);
  });

  it("lets customers cancel only before the restaurant accepts", () => {
    expect(
      checkTransition({ from: "awaiting_restaurant", to: "cancelled", actor: "customer" }).ok,
    ).toBe(true);
    expect(checkTransition({ from: "accepted", to: "cancelled", actor: "customer" })).toMatchObject(
      {
        ok: false,
        code: "actor_not_allowed",
      },
    );
  });

  it("requires an ETA to accept and a reason to reject", () => {
    expect(
      checkTransition({ from: "awaiting_restaurant", to: "accepted", actor: "restaurant" }),
    ).toMatchObject({
      ok: false,
      code: "eta_required",
    });
    expect(
      checkTransition({
        from: "awaiting_restaurant",
        to: "accepted",
        actor: "restaurant",
        etaAt: new Date(),
      }).ok,
    ).toBe(true);
    expect(
      checkTransition({
        from: "awaiting_restaurant",
        to: "rejected",
        actor: "restaurant",
        reason: "  ",
      }),
    ).toMatchObject({ ok: false, code: "reason_required" });
  });

  it("refuses to skip from a new order straight to collected", () => {
    expect(
      checkTransition({ from: "awaiting_restaurant", to: "collected", actor: "restaurant" }),
    ).toMatchObject({ ok: false, code: "invalid_transition" });
  });

  it("allows an audited correction from ready back to preparing", () => {
    expect(
      checkTransition({ from: "ready_for_collection", to: "preparing", actor: "restaurant" }),
    ).toMatchObject({ ok: false, code: "reason_required" });
    expect(
      checkTransition({
        from: "ready_for_collection",
        to: "preparing",
        actor: "restaurant",
        reason: "Marked ready by mistake",
      }).ok,
    ).toBe(true);
  });

  it("never moves out of a terminal status", () => {
    for (const from of TERMINAL_ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        expect(
          checkTransition({ from, to, actor: "platform_admin", reason: "x", etaAt: new Date() }).ok,
        ).toBe(false);
      }
    }
  });

  it("labels every status for customers and staff, never as 'Done'", () => {
    for (const status of ORDER_STATUSES) {
      expect(CUSTOMER_ORDER_LABELS[status]).toBeTruthy();
      expect(STAFF_ORDER_LABELS[status]).toBeTruthy();
      expect(CUSTOMER_ORDER_LABELS[status]).not.toMatch(/done/i);
    }
    expect(STAFF_ORDER_LABELS.awaiting_restaurant).toBe("New order");
  });
});
