import { describe, expect, it } from "vitest";
import { mapHref, orderModesLabel, phoneHref } from "./format";

describe("phoneHref", () => {
  it("keeps the leading plus and drops spacing and punctuation", () => {
    expect(phoneHref("+254 712 345 678")).toBe("tel:+254712345678");
    expect(phoneHref("(020) 123-4567")).toBe("tel:0201234567");
  });

  it("refuses things that aren't phone numbers", () => {
    expect(phoneHref("call us")).toBeNull();
    expect(phoneHref("12345")).toBeNull();
  });
});

describe("mapHref", () => {
  it("links to the pin", () => {
    expect(mapHref({ latitude: -1.2795, longitude: 36.8167 })).toBe(
      "https://www.openstreetmap.org/?mlat=-1.279500&mlon=36.816700#map=18/-1.279500/36.816700",
    );
  });

  it("refuses impossible coordinates", () => {
    expect(mapHref({ latitude: 91, longitude: 0 })).toBeNull();
    expect(mapHref({ latitude: Number.NaN, longitude: 0 })).toBeNull();
  });
});

describe("orderModesLabel", () => {
  it("names the order modes", () => {
    expect(orderModesLabel({ pickup: true, dineIn: true })).toBe("Pickup and dine-in");
    expect(orderModesLabel({ pickup: true, dineIn: false })).toBe("Pickup only");
    expect(orderModesLabel({ pickup: false, dineIn: true })).toBe("Dine-in only");
    expect(orderModesLabel({ pickup: false, dineIn: false })).toBeNull();
  });
});
