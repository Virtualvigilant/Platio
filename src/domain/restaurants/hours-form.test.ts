import { describe, expect, it } from "vitest";
import { fieldErrors, weeklyHoursSchema } from "./config";
import {
  MONDAY_FIRST,
  daysFromIntervals,
  daysFromValues,
  describeDay,
  formatNairobiDateTime,
  formatPresets,
  hoursField,
  intervalsFromValues,
  mapIntervalErrors,
  nairobiLocalToIso,
  toHHMM,
  toHoursPayload,
  toNairobiLocal,
} from "./hours-form";

/** Every day closed, plus the given open periods. */
function submitted(open: Record<number, [string, string][]>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const weekday of MONDAY_FIRST) {
    const periods = open[weekday];
    if (!periods) {
      values[hoursField.closed(weekday)] = "on";
      continue;
    }
    periods.forEach(([o, c], i) => {
      values[hoursField.opens(weekday, i)] = o;
      values[hoursField.closes(weekday, i)] = c;
    });
  }
  return values;
}

describe("hours editor", () => {
  it("shows Monday first and Sunday last", () => {
    expect(MONDAY_FIRST[0]).toBe(1);
    expect(MONDAY_FIRST[6]).toBe(0);
  });

  it("builds the editor from saved rows, sorted, with seconds dropped", () => {
    const days = daysFromIntervals([
      { weekday: 1, opensAt: "17:00:00", closesAt: "21:00:00" },
      { weekday: 1, opensAt: "07:30:00", closesAt: "14:00:00" },
      { weekday: 0, opensAt: "10:00", closesAt: "16:00" },
    ]);
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days[0]).toEqual({
      weekday: 1,
      closed: false,
      periods: [
        { opensAt: "07:30", closesAt: "14:00" },
        { opensAt: "17:00", closesAt: "21:00" },
      ],
    });
    expect(days[1]).toEqual({ weekday: 2, closed: true, periods: [] });
    expect(describeDay(days[0])).toBe("07:30–14:00, 17:00–21:00");
    expect(describeDay(days[1])).toBe("Closed");
  });

  it("turns submitted fields into intervals the schema accepts", () => {
    const parsed = intervalsFromValues(
      submitted({
        1: [
          ["07:30", "14:00"],
          ["17:00", "21:00"],
        ],
        6: [["10:00", "16:00"]],
      }),
    );
    expect(parsed.errors).toEqual({});
    expect(parsed.intervals).toEqual([
      { weekday: 1, opensAt: "07:30", closesAt: "14:00" },
      { weekday: 1, opensAt: "17:00", closesAt: "21:00" },
      { weekday: 6, opensAt: "10:00", closesAt: "16:00" },
    ]);
    expect(weeklyHoursSchema.safeParse(parsed.intervals).success).toBe(true);
    expect(toHoursPayload(parsed.intervals)[0]).toEqual({
      weekday: 1,
      opens_at: "07:30",
      closes_at: "14:00",
    });
  });

  it("allows a week with every day closed", () => {
    const parsed = intervalsFromValues(submitted({}));
    expect(parsed).toEqual({ intervals: [], sources: [], errors: {} });
  });

  it("asks for hours on an open day with none, and for missing times", () => {
    const values = submitted({ 2: [["", "14:00"]] });
    delete values[hoursField.closed(3)];
    const parsed = intervalsFromValues(values);
    expect(parsed.errors[hoursField.opens(2, 0)]).toBe("Enter the opening time.");
    expect(parsed.errors[hoursField.day(3)]).toMatch(/Add opening hours for Wednesday/);
    expect(parsed.intervals).toEqual([]);
  });

  it("ignores a period left completely empty", () => {
    const parsed = intervalsFromValues(
      submitted({
        4: [
          ["08:00", "12:00"],
          ["", ""],
        ],
      }),
    );
    expect(parsed.errors).toEqual({});
    expect(parsed.intervals).toHaveLength(1);
  });

  it("maps schema errors back to the editor's fields", () => {
    const parsed = intervalsFromValues(
      submitted({
        5: [
          ["12:00", "10:00"],
          ["09:00", "11:00"],
        ],
      }),
    );
    const result = weeklyHoursSchema.safeParse(parsed.intervals);
    expect(result.success).toBe(false);
    const mapped = mapIntervalErrors(fieldErrors(result.error!), parsed.sources);
    expect(mapped[hoursField.closes(5, 0)]).toMatch(/after opening time/);
    expect(Object.keys(mapped).every((k) => k.startsWith("h-5-"))).toBe(true);
  });

  it("maps day-level schema errors to the day", () => {
    expect(
      mapIntervalErrors({ "1": "Use at most three opening periods a day." }, [
        { weekday: 1, index: 0 },
        { weekday: 1, index: 1 },
      ]),
    ).toEqual({ [hoursField.day(1)]: "Use at most three opening periods a day." });
    expect(mapIntervalErrors({ "9.opensAt": "x" }, [])).toEqual({ _form: "x" });
  });

  it("rebuilds the editor from what was submitted", () => {
    const values = submitted({ 1: [["07:30", ""]] });
    const days = daysFromValues(values);
    expect(days[0]).toEqual({
      weekday: 1,
      closed: false,
      periods: [{ opensAt: "07:30", closesAt: "" }],
    });
    expect(days[6]).toEqual({ weekday: 0, closed: true, periods: [] });
  });

  it("normalizes times", () => {
    expect(toHHMM(" 07:30:00 ")).toBe("07:30");
    expect(toHHMM("7:30")).toBe("7:30");
    expect(toHHMM("")).toBe("");
  });
});

describe("closures in Nairobi time", () => {
  it("reads datetime-local values as Nairobi time", () => {
    expect(nairobiLocalToIso("2026-10-12T08:00")).toBe("2026-10-12T08:00:00+03:00");
    expect(new Date(nairobiLocalToIso("2026-10-12T08:00")).toISOString()).toBe(
      "2026-10-12T05:00:00.000Z",
    );
    expect(nairobiLocalToIso("2026-10-12T08:00:30")).toBe("2026-10-12T08:00:00+03:00");
  });

  it("rejects anything that isn't a datetime-local value", () => {
    expect(nairobiLocalToIso("")).toBe("");
    expect(nairobiLocalToIso("tomorrow")).toBe("");
    expect(nairobiLocalToIso("2026-10-12T08:00Z")).toBe("");
    expect(nairobiLocalToIso("2026-13-40T08:00")).toBe("");
  });

  it("shows stored instants in Nairobi time", () => {
    const d = new Date("2026-10-11T21:00:00Z");
    expect(toNairobiLocal(d)).toBe("2026-10-12T00:00");
    expect(formatNairobiDateTime(d)).toBe("Mon 12 Oct 2026, 00:00");
    expect(toNairobiLocal(new Date(nairobiLocalToIso("2026-12-31T23:45")))).toBe(
      "2026-12-31T23:45",
    );
  });

  it("formats prep presets for the form", () => {
    expect(formatPresets([5, 10, 15])).toBe("5, 10, 15");
  });
});
