import { describe, expect, it } from "vitest";
import type { OpeningHours } from "./business-status";
import { formatClosure, summarizeWeeklyHours, upcomingClosures } from "./hours-display";

const day = (weekday: number, opensAt: string, closesAt: string): OpeningHours => ({
  weekday,
  opensAt,
  closesAt,
});

const lines = (periods: OpeningHours[]) =>
  summarizeWeeklyHours(periods).map((l) => `${l.days} ${l.hours}`);

describe("summarizeWeeklyHours", () => {
  it("returns nothing when no day has hours", () => {
    expect(summarizeWeeklyHours([])).toEqual([]);
  });

  it("groups neighbouring days with the same hours, Monday first", () => {
    const week = [1, 2, 3, 4, 5, 6].map((d) => day(d, "07:30", "21:00"));
    expect(lines(week)).toEqual(["Mon–Sat 07:30–21:00", "Sun Closed"]);
  });

  it("spells out the days for screen readers and flags closed days", () => {
    const week = [1, 2, 3, 4, 5, 6].map((d) => day(d, "07:30", "21:00"));
    expect(summarizeWeeklyHours(week)).toEqual([
      { days: "Mon–Sat", daysLong: "Monday to Saturday", hours: "07:30–21:00", closed: false },
      { days: "Sun", daysLong: "Sunday", hours: "Closed", closed: true },
    ]);
  });

  it("says every day when the whole week matches", () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => day(d, "08:00", "20:00"));
    expect(summarizeWeeklyHours(week)).toEqual([
      { days: "Every day", daysLong: "Every day", hours: "08:00–20:00", closed: false },
    ]);
  });

  it("lists Sunday last even when it comes first in the data", () => {
    expect(lines([day(0, "10:00", "16:00"), day(1, "07:00", "19:00")])).toEqual([
      "Mon 07:00–19:00",
      "Tue–Sat Closed",
      "Sun 10:00–16:00",
    ]);
  });

  it("joins several periods in order and trims database seconds", () => {
    const periods = [
      day(1, "17:00:00", "21:00:00"),
      day(1, "07:30:00", "14:00:00"),
      day(2, "07:30", "14:00"),
      day(2, "17:00", "21:00"),
    ];
    expect(lines(periods)).toEqual(["Mon–Tue 07:30–14:00, 17:00–21:00", "Wed–Sun Closed"]);
  });

  it("only groups neighbouring days", () => {
    const periods = [day(1, "08:00", "17:00"), day(2, "09:00", "17:00"), day(3, "08:00", "17:00")];
    expect(lines(periods)).toEqual([
      "Mon 08:00–17:00",
      "Tue 09:00–17:00",
      "Wed 08:00–17:00",
      "Thu–Sun Closed",
    ]);
  });

  it("ignores malformed, backwards and duplicate periods", () => {
    const periods = [
      day(1, "08:00", "17:00"),
      day(1, "08:00", "17:00"),
      day(2, "8am", "5pm"),
      day(3, "18:00", "09:00"),
      day(9, "08:00", "17:00"),
    ];
    expect(lines(periods)).toEqual(["Mon 08:00–17:00", "Tue–Sun Closed"]);
  });
});

describe("closures", () => {
  // Nairobi is UTC+3 all year.
  const at = (iso: string) => new Date(iso);

  it("keeps closures that haven't ended, soonest first, up to a limit", () => {
    const now = at("2026-10-09T09:00:00Z");
    const past = { startAt: at("2026-10-01T05:00:00Z"), endAt: at("2026-10-02T15:00:00Z") };
    const later = { startAt: at("2026-10-20T05:00:00Z"), endAt: at("2026-10-21T15:00:00Z") };
    const soon = { startAt: at("2026-10-12T05:00:00Z"), endAt: at("2026-10-12T11:00:00Z") };
    const ongoing = { startAt: at("2026-10-09T05:00:00Z"), endAt: at("2026-10-09T15:00:00Z") };
    expect(upcomingClosures([past, later, soon, ongoing], now)).toEqual([ongoing, soon, later]);
    expect(upcomingClosures([past, later, soon, ongoing], now, 1)).toEqual([ongoing]);
  });

  it("formats a closure within one day in Nairobi time", () => {
    const closure = { startAt: at("2026-10-12T05:00:00Z"), endAt: at("2026-10-12T11:00:00Z") };
    expect(formatClosure(closure)).toBe("Mon 12 Oct, 08:00–14:00");
  });

  it("formats a closure over several days", () => {
    const closure = { startAt: at("2026-10-12T05:00:00Z"), endAt: at("2026-10-14T15:00:00Z") };
    expect(formatClosure(closure)).toBe("Mon 12 Oct, 08:00 – Wed 14 Oct, 18:00");
  });

  it("uses the local date, not the UTC date, to decide whether it is one day", () => {
    // 22:00 UTC on the 11th is 01:00 on the 12th in Nairobi.
    const closure = { startAt: at("2026-10-11T22:00:00Z"), endAt: at("2026-10-12T05:00:00Z") };
    expect(formatClosure(closure)).toBe("Mon 12 Oct, 01:00–08:00");
  });

  it("says when a closure that has started ends", () => {
    const closure = { startAt: at("2026-10-09T05:00:00Z"), endAt: at("2026-10-10T15:00:00Z") };
    expect(formatClosure(closure, { now: at("2026-10-09T09:00:00Z") })).toBe(
      "Now until Sat 10 Oct, 18:00",
    );
  });
});
