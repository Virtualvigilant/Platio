/**
 * Whether a restaurant can take an order right now (brief §5.1, §6.1): derived from its opening
 * hours plus manual pauses and temporary closures. Closed and paused restaurants stay viewable, but
 * ordering is disabled and the reason is explained.
 */
import { DEFAULT_TIME_ZONE } from "../prep-estimate";

export type BusinessStatus = "open" | "paused" | "closed";

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday, in the restaurant's local time. */
  weekday: number;
  /** "HH:MM" or "HH:MM:SS", local time. */
  opensAt: string;
  closesAt: string;
}

export interface Closure {
  startAt: Date;
  endAt: Date;
}

export interface BusinessState {
  status: BusinessStatus;
  /** Short suffix for the status pill, e.g. "until 21:00" or "opens Mon 07:30". */
  detail?: string;
  canOrder: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

export function zonedParts(date: Date, timeZone: string = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return { weekday: WEEKDAYS.indexOf(get("weekday")), minutes: hour * 60 + Number(get("minute")) };
}

export function getBusinessState(input: {
  lifecycle: "published" | "paused" | string;
  acceptingOrders: boolean;
  hours: readonly OpeningHours[];
  closures?: readonly Closure[];
  now: Date;
  timeZone?: string;
}): BusinessState {
  const { now, timeZone = DEFAULT_TIME_ZONE } = input;

  if (input.lifecycle === "paused" || !input.acceptingOrders) {
    return { status: "paused", detail: "not taking new orders", canOrder: false };
  }

  if (input.closures?.some((c) => c.startAt <= now && now < c.endAt)) {
    return { status: "closed", detail: "closed today", canOrder: false };
  }

  const { weekday, minutes } = zonedParts(now, timeZone);
  const today = input.hours
    .filter((h) => h.weekday === weekday)
    .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt));

  const current = today.find(
    (h) => toMinutes(h.opensAt) <= minutes && minutes < toMinutes(h.closesAt),
  );
  if (current) return { status: "open", detail: `until ${hhmm(current.closesAt)}`, canOrder: true };

  const laterToday = today.find((h) => toMinutes(h.opensAt) > minutes);
  if (laterToday)
    return { status: "closed", detail: `opens ${hhmm(laterToday.opensAt)}`, canOrder: false };

  for (let offset = 1; offset <= 7; offset++) {
    const day = (weekday + offset) % 7;
    const first = input.hours
      .filter((h) => h.weekday === day)
      .sort((a, b) => toMinutes(a.opensAt) - toMinutes(b.opensAt))[0];
    if (first) {
      const when = offset === 1 ? "tomorrow" : WEEKDAYS[day];
      return { status: "closed", detail: `opens ${when} ${hhmm(first.opensAt)}`, canOrder: false };
    }
  }
  return { status: "closed", canOrder: false };
}
