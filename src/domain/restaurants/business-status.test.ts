import { describe, expect, it } from "vitest";
import { getBusinessState, type OpeningHours } from "./business-status";

// Monday to Saturday, 07:30–21:00 Nairobi time.
const HOURS: OpeningHours[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  opensAt: "07:30:00",
  closesAt: "21:00:00",
}));

// 2026-10-09 is a Friday. Nairobi is UTC+3.
const at = (utc: string) => new Date(utc);
const base = { lifecycle: "published", acceptingOrders: true, hours: HOURS };

describe("getBusinessState", () => {
  it("is open inside today's hours", () => {
    expect(getBusinessState({ ...base, now: at("2026-10-09T09:00:00Z") })).toEqual({
      status: "open",
      detail: "until 21:00",
      canOrder: true,
    });
  });

  it("is closed before opening, with today's opening time", () => {
    expect(getBusinessState({ ...base, now: at("2026-10-09T03:00:00Z") })).toMatchObject({
      status: "closed",
      detail: "opens 07:30",
      canOrder: false,
    });
  });

  it("names tomorrow after closing time", () => {
    expect(getBusinessState({ ...base, now: at("2026-10-09T19:00:00Z") })).toMatchObject({
      status: "closed",
      detail: "opens tomorrow 07:30",
    });
  });

  it("skips days without hours", () => {
    // Saturday 22:00 local → closed Sunday → opens Monday.
    expect(getBusinessState({ ...base, now: at("2026-10-10T19:00:00Z") })).toMatchObject({
      status: "closed",
      detail: "opens Mon 07:30",
    });
  });

  it("is paused when staff pause new orders, even inside opening hours", () => {
    expect(
      getBusinessState({ ...base, acceptingOrders: false, now: at("2026-10-09T09:00:00Z") }),
    ).toMatchObject({
      status: "paused",
      canOrder: false,
    });
    expect(
      getBusinessState({ ...base, lifecycle: "paused", now: at("2026-10-09T09:00:00Z") }).status,
    ).toBe("paused");
  });

  it("honours temporary closures", () => {
    const closures = [{ startAt: at("2026-10-09T00:00:00Z"), endAt: at("2026-10-09T21:00:00Z") }];
    expect(getBusinessState({ ...base, closures, now: at("2026-10-09T09:00:00Z") })).toMatchObject({
      status: "closed",
      canOrder: false,
    });
  });

  it("is closed with no detail when there are no hours at all", () => {
    expect(getBusinessState({ ...base, hours: [], now: at("2026-10-09T09:00:00Z") })).toEqual({
      status: "closed",
      canOrder: false,
    });
  });
});
