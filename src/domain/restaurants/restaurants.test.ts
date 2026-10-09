import { describe, expect, it } from "vitest";
import { checkTenantColor, contrastRatio } from "./branding";
import { isValidSlug, slugify } from "./slug";

describe("slugs", () => {
  it.each([
    ["Mama Oliech Kitchen", "mama-oliech-kitchen"],
    ["Bean & Leaf Café", "bean-and-leaf-cafe"],
    ["  Campus   Grill!! ", "campus-grill"],
  ])("slugifies %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("rejects reserved, short and malformed slugs", () => {
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("Campus-Grill")).toBe(false);
    expect(isValidSlug("campus--grill")).toBe(false);
  });
});

describe("tenant colours", () => {
  it("matches the design system's measured contrast", () => {
    expect(contrastRatio("#167d8d", "#ffffff")).toBeCloseTo(4.83, 2);
  });

  it("prefers white text, falls back to ink, and refuses mid-tones", () => {
    expect(checkTenantColor("#7A2E12")).toMatchObject({
      ok: true,
      color: "#7a2e12",
      onColor: "#ffffff",
    });
    expect(checkTenantColor("#f5c542")).toMatchObject({ ok: true, onColor: "#182433" });
    expect(checkTenantColor("#ff6600").ok).toBe(true);
    expect(checkTenantColor("#e05a5a").ok).toBe(false);
    expect(checkTenantColor("#888888")).toMatchObject({ ok: false });
    expect(checkTenantColor("red")).toMatchObject({ ok: false });
  });
});
