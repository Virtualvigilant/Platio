import { describe, expect, it } from "vitest";
import {
  brandingSchema,
  categorySchema,
  closureSchema,
  fieldErrors,
  identitySchema,
  invitationSchema,
  locationSchema,
  menuItemSchema,
  modifierGroupSchema,
  modifierOptionSchema,
  newRestaurantSchema,
  operationsSchema,
  parseTags,
  paymentSettingsSchema,
  weeklyHoursSchema,
} from "./config";

const errorsOf = (r: { success: boolean; error?: unknown }) =>
  r.success ? {} : fieldErrors(r.error as Parameters<typeof fieldErrors>[0]);

describe("identity", () => {
  const base = {
    displayName: "  Mama Oliech Kitchen ",
    slug: "Mama-Oliech-Kitchen",
    description: "",
    cuisineTags: "kenyan, Fish,  fish , rice",
    legalName: "",
    publicPhone: "+254 712 345 678",
    contactEmail: "",
    contactPhone: "",
  };

  it("normalizes names, slugs, tags and empty optionals", () => {
    const r = identitySchema.parse(base);
    expect(r).toMatchObject({
      displayName: "Mama Oliech Kitchen",
      slug: "mama-oliech-kitchen",
      description: null,
      cuisineTags: ["Kenyan", "Fish", "Rice"],
      legalName: null,
      publicPhone: "+254 712 345 678",
      contactEmail: null,
    });
  });

  it("explains bad slugs, phones and emails", () => {
    const r = identitySchema.safeParse({
      ...base,
      slug: "a",
      publicPhone: "call me",
      contactEmail: "nope",
    });
    const e = errorsOf(r);
    expect(e.slug).toMatch(/lowercase letters/);
    expect(e.publicPhone).toMatch(/\+254/);
    expect(e.contactEmail).toMatch(/email address/);
  });

  it("caps cuisine labels", () => {
    const r = identitySchema.safeParse({ ...base, cuisineTags: "a,b,c,d,e,f,g,h,i" });
    expect(errorsOf(r).cuisineTags).toMatch(/at most 8/);
  });
});

describe("new restaurant", () => {
  it("suggests the address from the name", () => {
    expect(newRestaurantSchema.parse({ displayName: "Bean & Leaf Café" })).toEqual({
      displayName: "Bean & Leaf Café",
      slug: "bean-and-leaf-cafe",
    });
  });

  it("rejects names that make reserved or empty addresses", () => {
    expect(newRestaurantSchema.safeParse({ displayName: "Admin" }).success).toBe(false);
    expect(newRestaurantSchema.safeParse({ displayName: "!!" }).success).toBe(false);
  });
});

describe("location", () => {
  it("needs both coordinates or neither", () => {
    const base = {
      address: "Next to the library",
      serviceArea: "",
      directions: "",
      latitude: "",
      longitude: "",
    };
    expect(locationSchema.parse(base)).toMatchObject({
      latitude: null,
      longitude: null,
      serviceArea: null,
    });
    expect(errorsOf(locationSchema.safeParse({ ...base, latitude: "-0.17" })).longitude).toMatch(
      /both/,
    );
    expect(
      errorsOf(locationSchema.safeParse({ ...base, latitude: "95", longitude: "35" })).latitude,
    ).toMatch(/between -90 and 90/);
    expect(
      locationSchema.parse({ ...base, latitude: "-0.1698231", longitude: "35.9634" }),
    ).toMatchObject({
      latitude: -0.169823,
      longitude: 35.9634,
    });
  });
});

describe("hours", () => {
  it("accepts split shifts and rejects overlaps, overnight hours and bad times", () => {
    expect(
      weeklyHoursSchema.safeParse([
        { weekday: 1, opensAt: "07:30", closesAt: "11:00" },
        { weekday: 1, opensAt: "12:00", closesAt: "21:00" },
      ]).success,
    ).toBe(true);
    expect(
      errorsOf(
        weeklyHoursSchema.safeParse([
          { weekday: 1, opensAt: "07:30", closesAt: "12:30" },
          { weekday: 1, opensAt: "12:00", closesAt: "21:00" },
        ]),
      )["1.opensAt"],
    ).toMatch(/overlap/);
    expect(
      errorsOf(weeklyHoursSchema.safeParse([{ weekday: 2, opensAt: "22:00", closesAt: "02:00" }]))[
        "0.closesAt"
      ],
    ).toMatch(/after opening/);
    expect(
      weeklyHoursSchema.safeParse([{ weekday: 2, opensAt: "7:30", closesAt: "21:00" }]).success,
    ).toBe(false);
  });

  it("checks closure ranges", () => {
    expect(
      closureSchema.safeParse({
        startAt: "2026-10-12T00:00:00Z",
        endAt: "2026-10-11T00:00:00Z",
        reason: "",
      }).success,
    ).toBe(false);
  });
});

describe("operations", () => {
  const base = {
    pickupEnabled: true,
    dineInEnabled: false,
    pickupInstructions: "Side window",
    prepPresets: "20, 5,10, 10",
    defaultPrepMinutes: "10",
  };

  it("sorts and de-duplicates presets", () => {
    expect(operationsSchema.parse(base).prepPresets).toEqual([5, 10, 20]);
  });

  it("needs at least one order mode and sensible minutes", () => {
    expect(
      errorsOf(operationsSchema.safeParse({ ...base, pickupEnabled: false })).pickupEnabled,
    ).toMatch(/pickup, dine-in/);
    expect(operationsSchema.safeParse({ ...base, prepPresets: "5, 500" }).success).toBe(false);
    expect(operationsSchema.safeParse({ ...base, defaultPrepMinutes: "0" }).success).toBe(false);
  });
});

describe("branding", () => {
  it("picks the readable text colour or refuses the colour", () => {
    expect(brandingSchema.parse({ brandColor: "#7A2E12", layout: "standard" })).toEqual({
      brandColor: "#7a2e12",
      brandOnColor: "#ffffff",
      layout: "standard",
    });
    expect(brandingSchema.parse({ brandColor: "", layout: "cover" })).toEqual({
      brandColor: null,
      brandOnColor: null,
      layout: "cover",
    });
    expect(
      errorsOf(brandingSchema.safeParse({ brandColor: "#888888", layout: "standard" })).brandColor,
    ).toMatch(/hard to read/);
  });
});

describe("payments", () => {
  const base = {
    payAtPickupEnabled: true,
    onlineEnabled: false,
    provider: "",
    merchantReference: "",
    onboardingStatus: "not_started" as const,
  };

  it("needs a way to pay and finished onboarding for online payment", () => {
    expect(paymentSettingsSchema.safeParse(base).success).toBe(true);
    expect(
      errorsOf(paymentSettingsSchema.safeParse({ ...base, payAtPickupEnabled: false }))
        .payAtPickupEnabled,
    ).toBeTruthy();
    expect(
      errorsOf(paymentSettingsSchema.safeParse({ ...base, onlineEnabled: true })).onlineEnabled,
    ).toMatch(/onboarding/);
    expect(
      paymentSettingsSchema.safeParse({ ...base, onlineEnabled: true, onboardingStatus: "ready" })
        .success,
    ).toBe(true);
  });
});

describe("team", () => {
  it("normalizes invitation emails", () => {
    expect(invitationSchema.parse({ email: " Owner@Example.COM ", role: "owner" })).toEqual({
      email: "owner@example.com",
      role: "owner",
    });
    expect(invitationSchema.safeParse({ email: "x", role: "owner" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "a@b.co", role: "admin" }).success).toBe(false);
  });
});

describe("menu", () => {
  const item = {
    categoryId: "6f1c1f5e-0000-4000-9000-000000000011",
    name: " Pilau ",
    description: "",
    price: "350",
    prepMinutes: "",
    tags: "vegetarian",
  };

  it("parses prices into cents and optional prep times", () => {
    expect(menuItemSchema.parse(item)).toEqual({
      categoryId: item.categoryId,
      name: "Pilau",
      description: null,
      price: 35000,
      prepMinutes: null,
      tags: ["Vegetarian"],
    });
    expect(menuItemSchema.parse({ ...item, price: "1,250.50", prepMinutes: "15" })).toMatchObject({
      price: 125050,
      prepMinutes: 15,
    });
  });

  it("rejects negative or malformed prices and prep times", () => {
    expect(errorsOf(menuItemSchema.safeParse({ ...item, price: "-5" })).price).toMatch(/shillings/);
    expect(errorsOf(menuItemSchema.safeParse({ ...item, prepMinutes: "0" })).prepMinutes).toMatch(
      /1 to 120/,
    );
    expect(errorsOf(menuItemSchema.safeParse({ ...item, categoryId: "x" })).categoryId).toMatch(
      /category/,
    );
  });

  it("validates categories and modifier rules", () => {
    expect(categorySchema.safeParse({ name: " ", description: "" }).success).toBe(false);
    expect(
      errorsOf(
        modifierGroupSchema.safeParse({
          name: "Size",
          required: true,
          minSelect: "0",
          maxSelect: "1",
        }),
      ).minSelect,
    ).toMatch(/at least 1/);
    expect(
      errorsOf(
        modifierGroupSchema.safeParse({
          name: "Add-ons",
          required: false,
          minSelect: "3",
          maxSelect: "2",
        }),
      ).minSelect,
    ).toMatch(/more than the maximum/);
    expect(modifierOptionSchema.parse({ name: "Large", priceDelta: "50" })).toEqual({
      name: "Large",
      priceDelta: 5000,
    });
  });
});

describe("parseTags", () => {
  it("trims, capitalizes and de-duplicates", () => {
    expect(parseTags(" kenyan , KENYAN,  ,fish  and chips")).toEqual(["Kenyan", "Fish and chips"]);
  });
});
