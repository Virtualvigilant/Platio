/**
 * The weekly hours editor and closure form (brief §6.4, §7.2 step 4) as plain data.
 *
 * The editor shows Monday first, with each day either closed or open for up to three periods.
 * Its fields are named h-<weekday>-closed, h-<weekday>-<n>-opens and h-<weekday>-<n>-closes
 * (weekday 0 = Sunday, as stored). These helpers turn submitted fields into the intervals that
 * weeklyHoursSchema validates, map the schema's errors back onto the fields, and rebuild the
 * editor from saved rows or from what was submitted.
 *
 * Closures are entered as datetime-local values in Nairobi time and stored as UTC instants.
 */
import { BUSINESS_TIME_ZONE } from "../time";

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Display order: Monday to Sunday. Values are stored weekdays (0 = Sunday). */
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

export const MAX_PERIODS_PER_DAY = 3;

export interface Period {
  opensAt: string;
  closesAt: string;
}

export interface DayHours {
  weekday: number;
  closed: boolean;
  periods: Period[];
}

export interface Interval {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export const hoursField = {
  closed: (weekday: number) => `h-${weekday}-closed`,
  opens: (weekday: number, index: number) => `h-${weekday}-${index}-opens`,
  closes: (weekday: number, index: number) => `h-${weekday}-${index}-closes`,
  /** Errors about the whole day ("add hours or mark it closed", "at most three"). */
  day: (weekday: number) => `h-${weekday}`,
};

/** "07:30:00" → "07:30"; anything else is returned trimmed for the schema to judge. */
export function toHHMM(value: string): string {
  const v = value.trim();
  return /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v) ? v.slice(0, 5) : v;
}

const byOpening = (a: Period, b: Period) => a.opensAt.localeCompare(b.opensAt);

/** The editor's starting state from saved rows: Monday first, periods in time order. */
export function daysFromIntervals(rows: readonly Interval[]): DayHours[] {
  return MONDAY_FIRST.map((weekday) => {
    const periods = rows
      .filter((r) => r.weekday === weekday)
      .map((r) => ({ opensAt: toHHMM(r.opensAt), closesAt: toHHMM(r.closesAt) }))
      .sort(byOpening);
    return { weekday, closed: periods.length === 0, periods };
  });
}

/** Which period indexes the submitted values contain for a day, in order. */
function periodIndexes(values: Readonly<Record<string, string>>, weekday: number): number[] {
  const found: number[] = [];
  for (let i = 0; i < MAX_PERIODS_PER_DAY; i++) {
    if (hoursField.opens(weekday, i) in values || hoursField.closes(weekday, i) in values) {
      found.push(i);
    }
  }
  return found;
}

/** Rebuilds the editor from submitted values, so a failed save keeps what was typed. */
export function daysFromValues(values: Readonly<Record<string, string>>): DayHours[] {
  return MONDAY_FIRST.map((weekday) => {
    const closed = hoursField.closed(weekday) in values;
    const periods = periodIndexes(values, weekday).map((i) => ({
      opensAt: toHHMM(values[hoursField.opens(weekday, i)] ?? ""),
      closesAt: toHHMM(values[hoursField.closes(weekday, i)] ?? ""),
    }));
    return { weekday, closed, periods: closed ? [] : periods };
  });
}

export interface ParsedHours {
  intervals: Interval[];
  /** For each interval, the day and period it came from, to map schema errors back to fields. */
  sources: { weekday: number; index: number }[];
  /** Problems found before schema validation, keyed by field name. */
  errors: Record<string, string>;
}

/**
 * Submitted editor fields → intervals for weeklyHoursSchema. A period with both times empty is
 * ignored; an open day needs at least one complete period.
 */
export function intervalsFromValues(values: Readonly<Record<string, string>>): ParsedHours {
  const intervals: Interval[] = [];
  const sources: ParsedHours["sources"] = [];
  const errors: Record<string, string> = {};

  for (const weekday of MONDAY_FIRST) {
    if (hoursField.closed(weekday) in values) continue;
    const name = WEEKDAY_NAMES[weekday];
    let complete = 0;
    let partial = false;
    for (const i of periodIndexes(values, weekday)) {
      const opensAt = toHHMM(values[hoursField.opens(weekday, i)] ?? "");
      const closesAt = toHHMM(values[hoursField.closes(weekday, i)] ?? "");
      if (!opensAt && !closesAt) continue;
      if (!opensAt) {
        errors[hoursField.opens(weekday, i)] = "Enter the opening time.";
        partial = true;
        continue;
      }
      if (!closesAt) {
        errors[hoursField.closes(weekday, i)] = "Enter the closing time.";
        partial = true;
        continue;
      }
      intervals.push({ weekday, opensAt, closesAt });
      sources.push({ weekday, index: i });
      complete++;
    }
    if (complete === 0 && !partial) {
      errors[hoursField.day(weekday)] = `Add opening hours for ${name}, or mark ${name} as closed.`;
    }
  }
  return { intervals, sources, errors };
}

/**
 * weeklyHoursSchema reports errors by interval position ("2.closesAt", "4.opensAt", "5"); this
 * renames them to the editor's field names.
 */
export function mapIntervalErrors(
  schemaErrors: Readonly<Record<string, string>>,
  sources: ParsedHours["sources"],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, message] of Object.entries(schemaErrors)) {
    const [head, field] = path.split(".");
    const source = sources[Number(head)];
    let key: string;
    if (!source) key = "_form";
    else if (field === "opensAt") key = hoursField.opens(source.weekday, source.index);
    else if (field === "closesAt") key = hoursField.closes(source.weekday, source.index);
    else if (field === "weekday") key = "_form";
    else key = hoursField.day(source.weekday);
    if (!(key in out)) out[key] = message;
  }
  return out;
}

/** The p_hours argument of public.set_restaurant_hours(). */
export function toHoursPayload(intervals: readonly Interval[]) {
  return intervals.map((h) => ({ weekday: h.weekday, opens_at: h.opensAt, closes_at: h.closesAt }));
}

/** One day's hours as text: "07:30–14:00, 17:00–21:00" or "Closed". */
export function describeDay(day: DayHours): string {
  if (day.closed || day.periods.length === 0) return "Closed";
  return day.periods.map((p) => `${p.opensAt}–${p.closesAt}`).join(", ");
}

// ---------------------------------------------------------------------------------------------
// Closures: datetime-local inputs in Nairobi time (UTC+3 all year, no daylight saving).
// ---------------------------------------------------------------------------------------------

const NAIROBI_OFFSET = "+03:00";
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/;

/**
 * "2026-10-12T08:00" typed in Nairobi → "2026-10-12T08:00:00+03:00", an unambiguous instant.
 * Returns "" for anything that isn't a datetime-local value, so the schema reports it as missing.
 */
export function nairobiLocalToIso(value: string): string {
  const m = LOCAL_DATE_TIME.exec(value.trim());
  if (!m) return "";
  const iso = `${m[1]}T${m[2]}:00${NAIROBI_OFFSET}`;
  return Number.isNaN(new Date(iso).getTime()) ? "" : iso;
}

function nairobiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: String(Number(get("hour")) % 24).padStart(2, "0"),
    minute: get("minute"),
  };
}

/** A stored instant as a datetime-local value in Nairobi time: "2026-10-12T08:00". */
export function toNairobiLocal(date: Date): string {
  const p = nairobiParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "Mon 12 Oct 2026, 08:00" in Nairobi time, for closure lists. */
export function formatNairobiDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const p = nairobiParts(date);
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("year")}, ${p.hour}:${p.minute}`;
}

/** Prep-time presets as the form shows them: "5, 10, 15, 20, 30". */
export function formatPresets(presets: readonly number[]): string {
  return presets.join(", ");
}
