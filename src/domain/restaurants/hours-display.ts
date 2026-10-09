/**
 * Opening hours as customers read them on a storefront (brief §5.2): the week from Monday, with
 * neighbouring days that share the same hours grouped ("Mon–Sat 07:30–21:00", "Sun Closed") and
 * several periods in one day joined with ", ". Temporary closures are shown in the restaurant's
 * local time (Africa/Nairobi for the MVP).
 */
import { DEFAULT_TIME_ZONE, formatClock } from "../prep-estimate";
import type { Closure, OpeningHours } from "./business-status";

/** Weekday numbers (0 = Sunday) in the order a storefront lists them. */
export const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0] as const;

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const LONG_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface HoursLine {
  /** "Mon–Sat", "Sun" or "Every day". */
  days: string;
  /** The same days spelled out for screen readers: "Monday to Saturday". */
  daysLong: string;
  /** "07:30–21:00", "07:30–14:00, 17:00–21:00" or "Closed". */
  hours: string;
  closed: boolean;
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/** "07:30:00" or "07:30" → "07:30"; anything else → null. */
function clock(value: string): string | null {
  return CLOCK.test(value) ? value.slice(0, 5) : null;
}

/** One day's periods as "07:30–14:00, 17:00–21:00", or null when the day has none. */
function dayHours(periods: readonly OpeningHours[], weekday: number): string | null {
  const labels = periods
    .filter((p) => p.weekday === weekday)
    .map((p) => ({ opens: clock(p.opensAt), closes: clock(p.closesAt) }))
    .filter(
      (p): p is { opens: string; closes: string } =>
        p.opens !== null && p.closes !== null && p.closes > p.opens,
    )
    .sort((a, b) => a.opens.localeCompare(b.opens) || a.closes.localeCompare(b.closes))
    .map((p) => `${p.opens}–${p.closes}`);
  const unique = [...new Set(labels)];
  return unique.length ? unique.join(", ") : null;
}

function dayRange(days: readonly number[], names: readonly string[], joiner: string): string {
  const first = names[days[0]];
  return days.length === 1 ? first : `${first}${joiner}${names[days[days.length - 1]]}`;
}

/**
 * The weekly summary, Monday first. Only neighbouring days are grouped, so the list always reads
 * in week order. Returns an empty list when no day has opening hours.
 */
export function summarizeWeeklyHours(periods: readonly OpeningHours[]): HoursLine[] {
  const week = WEEK_FROM_MONDAY.map((day) => ({ day, hours: dayHours(periods, day) }));
  if (week.every((d) => d.hours === null)) return [];

  const runs: { days: number[]; hours: string | null }[] = [];
  for (const { day, hours } of week) {
    const last = runs[runs.length - 1];
    if (last && last.hours === hours) last.days.push(day);
    else runs.push({ days: [day], hours });
  }

  if (runs.length === 1) {
    return [
      { days: "Every day", daysLong: "Every day", hours: runs[0].hours ?? "", closed: false },
    ];
  }
  return runs.map((run) => ({
    days: dayRange(run.days, SHORT_DAYS, "–"),
    daysLong: dayRange(run.days, LONG_DAYS, " to "),
    hours: run.hours ?? "Closed",
    closed: run.hours === null,
  }));
}

/** Closures that haven't ended yet, soonest first. */
export function upcomingClosures(closures: readonly Closure[], now: Date, limit = 3): Closure[] {
  return closures
    .filter((c) => c.endAt > now)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .slice(0, limit);
}

function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

/**
 * A closure in local time: "Sat 12 Oct, 08:00–14:00", "Sat 12 Oct, 08:00 – Mon 14 Oct, 18:00",
 * or "Now until Mon 14 Oct, 18:00" once it has started.
 */
export function formatClosure(
  closure: Closure,
  options: { now?: Date; timeZone?: string } = {},
): string {
  const { now, timeZone = DEFAULT_TIME_ZONE } = options;
  const end = `${localDay(closure.endAt, timeZone)}, ${formatClock(closure.endAt, timeZone)}`;
  if (now && closure.startAt <= now) return `Now until ${end}`;

  const start = `${localDay(closure.startAt, timeZone)}, ${formatClock(closure.startAt, timeZone)}`;
  if (localDate(closure.startAt, timeZone) === localDate(closure.endAt, timeZone)) {
    return `${start}–${formatClock(closure.endAt, timeZone)}`;
  }
  return `${start} – ${end}`;
}
