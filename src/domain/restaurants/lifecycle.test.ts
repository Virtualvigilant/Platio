import { describe, expect, it } from "vitest";
import { platformCan } from "../access";
import { RESTAURANT_STATUSES, RESTAURANT_TRANSITIONS, findRestaurantTransition } from "./lifecycle";

describe("restaurant lifecycle", () => {
  it("only targets known statuses and never loops to itself", () => {
    for (const from of RESTAURANT_STATUSES) {
      for (const t of RESTAURANT_TRANSITIONS[from]) {
        expect(RESTAURANT_STATUSES).toContain(t.to);
        expect(t.to).not.toBe(from);
      }
    }
  });

  it("can reach published from a draft, directly or through review", () => {
    expect(findRestaurantTransition("draft", "published")).toBeTruthy();
    expect(findRestaurantTransition("draft", "ready_for_review")).toBeTruthy();
    expect(findRestaurantTransition("ready_for_review", "published")).toBeTruthy();
  });

  it("needs an audit reason to pause, suspend, unpublish, reactivate or archive", () => {
    expect(findRestaurantTransition("published", "paused")?.requiresReason).toBe(true);
    expect(findRestaurantTransition("published", "suspended")?.requiresReason).toBe(true);
    expect(findRestaurantTransition("published", "draft")?.requiresReason).toBe(true);
    expect(findRestaurantTransition("suspended", "published")?.requiresReason).toBe(true);
    expect(findRestaurantTransition("archived", "draft")?.requiresReason).toBe(true);
    for (const from of RESTAURANT_STATUSES) {
      expect(findRestaurantTransition(from, "archived")?.requiresReason ?? true).toBe(true);
    }
  });

  it("keeps archived records out of every state but draft", () => {
    expect(RESTAURANT_TRANSITIONS.archived.map((t) => t.to)).toEqual(["draft"]);
  });

  it("lets support staff onboard but not publish or suspend", () => {
    for (const from of RESTAURANT_STATUSES) {
      for (const t of RESTAURANT_TRANSITIONS[from]) {
        if (t.to === "published" || t.to === "suspended") {
          expect(platformCan("support", t.permission)).toBe(false);
          expect(platformCan("super_admin", t.permission)).toBe(true);
        }
      }
    }
    expect(
      platformCan("support", findRestaurantTransition("draft", "ready_for_review")!.permission),
    ).toBe(true);
  });
});
