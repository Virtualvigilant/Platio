// Renders the builder and the staff list with sample data, so a broken component or a wrong
// label shows up without a browser. The Server Actions are stubbed; nothing here talks to a server.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MenuForEditing } from "@/server/menu/queries";
import { toPriceInput } from "./format";

vi.mock("@/server/menu/actions", () => {
  const stub = async () => ({ status: "idle" });
  return Object.fromEntries(
    [
      "createCategory",
      "updateCategory",
      "archiveCategory",
      "restoreCategory",
      "deleteCategory",
      "moveCategory",
      "createMenuItem",
      "updateMenuItem",
      "archiveMenuItem",
      "restoreMenuItem",
      "moveMenuItem",
      "setMenuItemAvailability",
      "createModifierGroup",
      "updateModifierGroup",
      "deleteModifierGroup",
      "createModifierOption",
      "updateModifierOption",
      "deleteModifierOption",
    ].map((name) => [name, stub]),
  );
});

const { MenuBuilder, AvailabilityList } = await import("./index");

const R = "11111111-1111-4111-8111-111111111111";

const dish = (over: Partial<MenuForEditing["items"][number]>): MenuForEditing["items"][number] => ({
  id: "i",
  categoryId: "c1",
  name: "Dish",
  description: null,
  priceMinor: 10000,
  prepMinutes: null,
  tags: [],
  imagePath: null,
  imageUrl: null,
  sortOrder: 1,
  active: true,
  available: true,
  modifierGroupIds: [],
  ...over,
});

const menu: MenuForEditing = {
  restaurantId: R,
  categories: [
    { id: "c1", name: "Main dishes", description: "Served all day", sortOrder: 1, active: true },
    { id: "c2", name: "Drinks", description: null, sortOrder: 2, active: true },
    { id: "c3", name: "Old specials", description: null, sortOrder: 3, active: false },
  ],
  items: [
    dish({
      id: "i1",
      name: "Pilau with kachumbari",
      priceMinor: 35050,
      prepMinutes: 15,
      tags: ["Spicy"],
      modifierGroupIds: ["g1"],
    }),
    dish({ id: "i2", name: "Githeri", priceMinor: 22000, sortOrder: 2, available: false }),
    dish({ id: "i3", name: "Retired stew", sortOrder: 3, active: false }),
  ],
  modifierGroups: [
    {
      id: "g1",
      name: "Size",
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 1,
      itemIds: ["i1"],
      options: [
        {
          id: "o1",
          groupId: "g1",
          name: "Large",
          priceDeltaMinor: 5000,
          active: true,
          sortOrder: 1,
        },
        { id: "o2", groupId: "g1", name: "Small", priceDeltaMinor: 0, active: false, sortOrder: 2 },
      ],
    },
    {
      id: "g2",
      name: "Sides",
      required: true,
      minSelect: 2,
      maxSelect: 2,
      sortOrder: 2,
      itemIds: [],
      options: [],
    },
  ],
};

describe("MenuBuilder", () => {
  it("shows categories, dishes, choices and the archive with their status words", () => {
    const html = renderToStaticMarkup(createElement(MenuBuilder, { restaurantId: R, menu }));
    for (const text of [
      "2 categories · 2 dishes on the menu · 1 unavailable",
      "Main dishes",
      "KES 350.50",
      "Mark unavailable",
      "Mark available",
      "Unavailable",
      "Price changes apply to new orders only.",
      "Choices: Size",
      "Required · choose 1",
      "+ KES 50",
      "Not offered",
      "Offered with Pilau with kachumbari.",
      "No options yet.",
      "Show 1 archived category and 1 archived dish",
      "Add dish",
      "Add category",
      "Add choice group",
    ]) {
      expect(html, text).toContain(text);
    }
    // An archived dish appears only in the archive, never as a dish card.
    expect(html).not.toContain("Retired stew</h3>");
    // Only an empty category offers Delete.
    expect(html).toContain('id="category-c2-delete"');
    expect(html).not.toContain('id="category-c1-delete"');
  });

  it("explains what to do with an empty menu", () => {
    const html = renderToStaticMarkup(
      createElement(MenuBuilder, {
        restaurantId: R,
        menu: { restaurantId: R, categories: [], items: [], modifierGroups: [] },
      }),
    );
    expect(html).toContain("No dishes yet. Add a category, then add dishes to it.");
    expect(html).not.toContain("Archived");
  });
});

describe("AvailabilityList", () => {
  it("lists dishes on the menu with one availability control each, and nothing else", () => {
    const html = renderToStaticMarkup(createElement(AvailabilityList, { restaurantId: R, menu }));
    expect(html).toContain("1 of 2 dishes unavailable");
    expect(html).toContain("Mark unavailable");
    expect(html).toContain("Mark available");
    expect(html).not.toContain("Retired stew");
    expect(html).not.toContain("Edit");
    expect(html).not.toContain("Archive");
    expect(html).not.toContain("Drinks"); // a category with no dishes isn't shown
  });
});

describe("toPriceInput", () => {
  it("turns cents back into what was typed", () => {
    expect(toPriceInput(35000)).toBe("350");
    expect(toPriceInput(35050)).toBe("350.50");
    expect(toPriceInput(35005)).toBe("350.05");
    expect(toPriceInput(0)).toBe("0");
  });
});
