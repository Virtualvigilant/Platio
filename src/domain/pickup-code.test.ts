import { describe, expect, it } from "vitest";
import {
  PICKUP_ALPHABET,
  generatePickupCode,
  isWellFormedPickupCode,
  normalizePickupCode,
} from "./pickup-code";

describe("pickup codes", () => {
  it("generates codes of the requested length from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePickupCode();
      expect(code).toHaveLength(4);
      expect([...code].every((c) => PICKUP_ALPHABET.includes(c))).toBe(true);
    }
  });

  it("leaves out look-alike characters", () => {
    for (const c of "0OQ1IL2Z5S6G8B") expect(PICKUP_ALPHABET).not.toContain(c);
  });

  it("discards biased bytes instead of wrapping them", () => {
    // 252 and above would bias the result for a 22-character alphabet; they must be skipped.
    const bytes = [255, 254, 253, 252, 0, 1, 2, 3];
    let call = 0;
    const code = generatePickupCode(4, (buf) => {
      buf.set(bytes.slice(call * buf.length, call * buf.length + buf.length));
      call++;
      return buf;
    });
    expect(code).toBe(PICKUP_ALPHABET.slice(0, 4));
  });

  it("does not repeat codes often", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generatePickupCode()));
    expect(seen.size).toBeGreaterThan(480);
  });

  it("normalizes what staff type", () => {
    expect(normalizePickupCode(" k7-a4 ")).toBe("K7A4");
    expect(isWellFormedPickupCode("k7a4")).toBe(true);
    expect(isWellFormedPickupCode("K0A4")).toBe(false);
    expect(isWellFormedPickupCode("K7A")).toBe(false);
  });
});
