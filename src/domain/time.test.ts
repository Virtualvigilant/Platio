import { describe, expect, it } from "vitest";
import { businessDate, startOfBusinessDay } from "./time";

describe("Nairobi business day", () => {
  it("starts at 21:00 UTC the previous day", () => {
    expect(startOfBusinessDay(new Date("2026-10-09T09:00:00Z")).toISOString()).toBe(
      "2026-10-08T21:00:00.000Z",
    );
  });

  it("rolls over at local midnight, not UTC midnight", () => {
    // 22:30 UTC on the 9th is 01:30 on the 10th in Nairobi.
    expect(businessDate(new Date("2026-10-09T22:30:00Z"))).toBe("2026-10-10");
    expect(startOfBusinessDay(new Date("2026-10-09T22:30:00Z")).toISOString()).toBe(
      "2026-10-09T21:00:00.000Z",
    );
  });
});
