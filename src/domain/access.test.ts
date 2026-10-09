import { describe, expect, it } from "vitest";
import { platformCan, restaurantCan } from "./access";

describe("restaurant roles", () => {
  it("lets every role work the order queue", () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      expect(restaurantCan(role, "orders.update_status")).toBe(true);
      expect(restaurantCan(role, "menu.availability")).toBe(true);
    }
  });

  it("keeps team management with owners and reports away from counter staff", () => {
    expect(restaurantCan("owner", "team.manage")).toBe(true);
    expect(restaurantCan("manager", "team.manage")).toBe(false);
    expect(restaurantCan("staff", "reports.read")).toBe(false);
    expect(restaurantCan("staff", "menu.edit")).toBe(false);
  });
});

describe("platform roles", () => {
  it("limits support staff to reading and onboarding", () => {
    expect(platformCan("support", "restaurants.onboard")).toBe(true);
    expect(platformCan("support", "payments.resolve")).toBe(false);
    expect(platformCan("support", "users.manage")).toBe(false);
    expect(platformCan("super_admin", "users.manage")).toBe(true);
  });
});
