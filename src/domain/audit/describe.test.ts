import { describe, expect, it } from "vitest";
import {
  AUDIT_FIELD_LABELS,
  describeActor,
  describeAuditEntry,
  fieldNames,
  formatAuditTime,
  joinWords,
} from "./describe";

const AMINA = "8a6f6a4e-2f0c-4b51-9f7e-0d6f1c1e2a10";

describe("describeAuditEntry", () => {
  it("describes a new restaurant with its web address", () => {
    expect(describeAuditEntry("restaurant.created", { slug: "mama-oliech" })).toBe(
      "Created the restaurant with the web address /restaurants/mama-oliech",
    );
    expect(describeAuditEntry("restaurant.created", {})).toBe("Created the restaurant");
  });

  it("names the fields an update changed in plain words", () => {
    expect(describeAuditEntry("restaurant.updated", { fields: ["description", "logo_path"] })).toBe(
      "Updated description and logo",
    );
    expect(
      describeAuditEntry("restaurant.updated", {
        fields: ["brand_color", "brand_on_color", "storefront_layout"],
      }),
    ).toBe("Updated brand colour and layout");
    expect(
      describeAuditEntry("restaurant.updated", {
        fields: ["address", "latitude", "longitude", "service_area"],
      }),
    ).toBe("Updated address, map position and service area");
    expect(describeAuditEntry("restaurant.updated", { fields: ["slug", "display_name"] })).toBe(
      "Updated web address and display name",
    );
  });

  it("falls back when an update lists no fields or unknown ones", () => {
    expect(describeAuditEntry("restaurant.updated", { fields: [] })).toBe(
      "Updated the restaurant’s details",
    );
    expect(describeAuditEntry("restaurant.updated", { fields: "description" })).toBe(
      "Updated the restaurant’s details",
    );
    expect(describeAuditEntry("restaurant.updated", { fields: ["menu_banner_path", 3] })).toBe(
      "Updated menu banner",
    );
  });

  it("describes status changes with the lifecycle's labels", () => {
    expect(
      describeAuditEntry("restaurant.status_changed", { from: "draft", to: "published" }),
    ).toBe("Changed status from Draft to Published");
    expect(
      describeAuditEntry("restaurant.status_changed", {
        from: "ready_for_review",
        to: "archived",
      }),
    ).toBe("Changed status from Ready for review to Archived");
    expect(describeAuditEntry("restaurant.status_changed", { to: "suspended" })).toBe(
      "Changed status to Suspended",
    );
    expect(describeAuditEntry("restaurant.status_changed", null)).toBe(
      "Changed the restaurant’s status",
    );
    expect(describeAuditEntry("restaurant.status_changed", { from: "draft", to: "on_hold" })).toBe(
      "Changed status from Draft to On hold",
    );
  });

  it("describes hours and the restaurant's own pause switch", () => {
    expect(describeAuditEntry("restaurant.hours_changed", { periods: 12 })).toBe(
      "Changed opening hours",
    );
    expect(describeAuditEntry("restaurant.hours_changed", { periods: 0 })).toBe(
      "Removed all opening hours",
    );
    expect(describeAuditEntry("restaurant.hours_changed", {})).toBe("Changed opening hours");
    expect(describeAuditEntry("restaurant.paused_orders", {})).toBe("Paused new orders");
    expect(describeAuditEntry("restaurant.resumed_orders", {})).toBe("Resumed orders");
  });

  it("formats price changes in KES from integer cents", () => {
    expect(
      describeAuditEntry("menu_item.price_changed", { name: "Pilau", from: 35000, to: 36000 }),
    ).toBe("Changed the price of Pilau from KES 350 to KES 360");
    expect(
      describeAuditEntry("menu_item.price_changed", { name: "Chai", from: 5050, to: 125000 }),
    ).toBe("Changed the price of Chai from KES 50.50 to KES 1,250");
    expect(describeAuditEntry("menu_item.price_changed", { name: "Chai", to: 6000 })).toBe(
      "Changed the price of Chai to KES 60",
    );
    expect(
      describeAuditEntry("menu_item.price_changed", { name: "Chai", from: 1.5, to: "x" }),
    ).toBe("Changed the price of Chai");
    expect(describeAuditEntry("menu_item.price_changed", { from: 100, to: 200 })).toBe(
      "Changed the price of a dish from KES 1 to KES 2",
    );
  });

  it("describes archiving and restoring dishes", () => {
    expect(describeAuditEntry("menu_item.archived", { name: "Beef samosa" })).toBe(
      "Archived Beef samosa from the menu",
    );
    expect(describeAuditEntry("menu_item.restored", { name: "Beef samosa" })).toBe(
      "Restored Beef samosa to the menu",
    );
    expect(describeAuditEntry("menu_item.archived", {})).toBe("Archived a dish from the menu");
  });

  it("keeps long or messy restaurant-supplied names short and on one line", () => {
    const long = "Pilau ".repeat(40);
    const sentence = describeAuditEntry("menu_item.archived", { name: long });
    expect(sentence.length).toBeLessThan(120);
    expect(sentence).toContain("…");
    expect(describeAuditEntry("menu_item.archived", { name: " Ugali\n  and  greens " })).toBe(
      "Archived Ugali and greens from the menu",
    );
  });

  it("describes team changes, naming people when the viewer may see them", () => {
    const personName = (id: string) => (id === AMINA ? "Amina Otieno" : null);
    expect(
      describeAuditEntry(
        "membership.insert",
        { user_id: AMINA, role: "owner", status: "active" },
        { personName },
      ),
    ).toBe("Added Amina Otieno to the team as owner");
    expect(
      describeAuditEntry("membership.insert", { user_id: "someone-else", role: "staff" }),
    ).toBe("Added a team member to the team as staff");
    expect(
      describeAuditEntry(
        "membership.insert",
        { user_id: AMINA, role: "manager", status: "invited" },
        { personName },
      ),
    ).toBe("Invited Amina Otieno as manager");
    expect(
      describeAuditEntry(
        "membership.update",
        { user_id: AMINA, role: "owner", status: "revoked" },
        { personName },
      ),
    ).toBe("Removed Amina Otieno from the team");
    expect(
      describeAuditEntry(
        "membership.update",
        { user_id: AMINA, role: "manager", status: "active" },
        { personName },
      ),
    ).toBe("Gave Amina Otieno team access as manager");
    expect(describeAuditEntry("membership.update", { status: "active" })).toBe(
      "Updated the team access of a team member",
    );
  });

  it("describes invitations", () => {
    expect(
      describeAuditEntry("invitation.created", { email: "owner@example.com", role: "owner" }),
    ).toBe("Invited owner@example.com as owner");
    expect(describeAuditEntry("invitation.created", { email: "x@example.com" })).toBe(
      "Invited x@example.com to the team",
    );
    expect(
      describeAuditEntry("invitation.revoked", { email: "cook@example.com", role: "staff" }),
    ).toBe("Withdrew the staff invitation for cook@example.com");
    expect(describeAuditEntry("invitation.revoked", {})).toBe("Withdrew the invitation");
    expect(describeAuditEntry("invitation.accepted", { role: "manager" })).toBe(
      "Accepted an invitation and joined as manager",
    );
    expect(describeAuditEntry("invitation.accepted", { role: "chef" })).toBe(
      "Accepted an invitation and joined the team",
    );
  });

  it("gives unknown actions a readable fallback", () => {
    expect(describeAuditEntry("order.refund_flagged", {})).toBe("Order refund flagged");
    expect(describeAuditEntry("", {})).toBe("Made a change");
  });

  it("ignores metadata that is not an object", () => {
    expect(describeAuditEntry("menu_item.archived", "Pilau")).toBe("Archived a dish from the menu");
    expect(describeAuditEntry("restaurant.updated", ["description"])).toBe(
      "Updated the restaurant’s details",
    );
  });

  it("describes every action the migrations write without a fallback", () => {
    const written = [
      "restaurant.created",
      "restaurant.updated",
      "restaurant.status_changed",
      "restaurant.hours_changed",
      "restaurant.paused_orders",
      "restaurant.resumed_orders",
      "menu_item.price_changed",
      "menu_item.archived",
      "menu_item.restored",
      "membership.insert",
      "membership.update",
      "invitation.created",
      "invitation.revoked",
      "invitation.accepted",
    ];
    for (const action of written) {
      const fallback = action.replace(/[_.]/g, " ");
      expect(describeAuditEntry(action, {}).toLowerCase()).not.toBe(fallback);
    }
  });
});

describe("fieldNames and joinWords", () => {
  it("labels every column owners and platform staff can change", () => {
    for (const column of [
      "display_name",
      "slug",
      "description",
      "cuisine_tags",
      "public_phone",
      "logo_path",
      "cover_path",
      "brand_color",
      "storefront_layout",
      "service_area",
      "address",
      "directions",
      "latitude",
      "pickup_enabled",
      "dine_in_enabled",
      "pickup_instructions",
      "prep_presets",
      "default_prep_minutes",
    ]) {
      expect(AUDIT_FIELD_LABELS[column]).toBeTruthy();
      expect(AUDIT_FIELD_LABELS[column]).not.toMatch(/_/);
    }
  });

  it("de-duplicates labels and keeps their order", () => {
    expect(fieldNames(["longitude", "latitude", "brand_on_color", "brand_color"])).toEqual([
      "map position",
      "brand colour",
    ]);
  });

  it("joins words as a sentence", () => {
    expect(joinWords([])).toBe("");
    expect(joinWords(["logo"])).toBe("logo");
    expect(joinWords(["logo", "description"])).toBe("logo and description");
    expect(joinWords(["logo", "description", "address"])).toBe("logo, description and address");
  });
});

describe("describeActor", () => {
  it("shows changes with no actor as the system", () => {
    expect(describeActor({ actorId: null })).toEqual({
      kind: "system",
      name: "System",
      detail: null,
    });
  });

  it("names platform staff when their profile is readable", () => {
    expect(
      describeActor({ actorId: AMINA, displayName: "Amina Otieno", platformRole: "super_admin" }),
    ).toEqual({ kind: "platform", name: "Amina Otieno", detail: "Platform staff · Super-admin" });
    expect(describeActor({ actorId: AMINA, platformRole: "support" })).toEqual({
      kind: "platform",
      name: "Platform staff",
      detail: "Support",
    });
  });

  it("treats an actor outside the restaurant's team as platform staff", () => {
    // Support staff can read only their own platform_staff row.
    expect(describeActor({ actorId: AMINA })).toEqual({
      kind: "platform",
      name: "Platform staff",
      detail: null,
    });
    expect(describeActor({ actorId: AMINA, displayName: "  " })).toMatchObject({
      name: "Platform staff",
    });
  });

  it("names restaurant team members by name, then email, then role", () => {
    expect(
      describeActor({ actorId: AMINA, displayName: "Wanjiku", membershipRole: "manager" }),
    ).toEqual({ kind: "restaurant", name: "Wanjiku", detail: "Restaurant team · Manager" });
    expect(
      describeActor({ actorId: AMINA, email: "owner@example.com", membershipRole: "owner" }),
    ).toEqual({ kind: "restaurant", name: "owner@example.com", detail: "Restaurant team · Owner" });
    expect(describeActor({ actorId: AMINA, membershipRole: "staff" })).toEqual({
      kind: "restaurant",
      name: "Restaurant team",
      detail: "Staff",
    });
  });

  it("prefers a known platform role over a membership", () => {
    expect(
      describeActor({ actorId: AMINA, platformRole: "support", membershipRole: "owner" }).kind,
    ).toBe("platform");
  });
});

describe("formatAuditTime", () => {
  it("shows the date and clock time in Nairobi", () => {
    expect(formatAuditTime("2026-10-09T11:05:00Z")).toBe("9 Oct 2026, 14:05");
    // 22:30 UTC is already the next day in Nairobi.
    expect(formatAuditTime(new Date("2026-12-31T22:30:00Z"))).toBe("1 Jan 2027, 01:30");
  });

  it("does not throw on a bad timestamp", () => {
    expect(formatAuditTime("not a date")).toBe("Unknown time");
  });
});
