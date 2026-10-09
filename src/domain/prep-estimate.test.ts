import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREP_SETTINGS,
  addMinutes,
  formatClock,
  isValidPrepEntry,
  nearestPresetAtLeast,
  suggestPrepMinutes,
} from "./prep-estimate";

describe("suggestPrepMinutes", () => {
  it("uses the longest item prep time", () => {
    expect(
      suggestPrepMinutes([{ prepMinutes: 5 }, { prepMinutes: 15 }, { prepMinutes: null }], 0),
    ).toBe(15);
  });

  it("falls back to the default when no item has a prep time", () => {
    expect(suggestPrepMinutes([{}, { prepMinutes: 0 }], 0)).toBe(
      DEFAULT_PREP_SETTINGS.defaultMinutes,
    );
  });

  it("adds a capped buffer for the current kitchen load", () => {
    expect(suggestPrepMinutes([{ prepMinutes: 10 }], 4)).toBe(14);
    expect(suggestPrepMinutes([{ prepMinutes: 10 }], 100)).toBe(
      10 + DEFAULT_PREP_SETTINGS.maxBufferMinutes,
    );
  });

  it("stays inside the allowed range", () => {
    expect(suggestPrepMinutes([{ prepMinutes: 500 }], 0)).toBe(DEFAULT_PREP_SETTINGS.maxMinutes);
  });
});

describe("presets and entries", () => {
  it("picks the smallest preset that covers the suggestion", () => {
    expect(nearestPresetAtLeast(14)).toBe(15);
    expect(nearestPresetAtLeast(15)).toBe(15);
    expect(nearestPresetAtLeast(31)).toBeNull();
  });

  it("accepts whole minutes in range only", () => {
    expect(isValidPrepEntry(12)).toBe(true);
    expect(isValidPrepEntry(0)).toBe(false);
    expect(isValidPrepEntry(12.5)).toBe(false);
    expect(isValidPrepEntry(121)).toBe(false);
  });
});

describe("times", () => {
  it("shows ETAs as 24-hour Nairobi clock times", () => {
    const acceptedAt = new Date("2026-10-09T09:35:00Z"); // 12:35 in Nairobi (UTC+3)
    expect(formatClock(addMinutes(acceptedAt, 15))).toBe("12:50");
  });
});
