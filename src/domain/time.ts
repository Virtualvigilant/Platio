/**
 * The MVP runs in Africa/Nairobi (brief §16), which is UTC+3 all year with no daylight saving.
 * Timestamps are stored in UTC and converted only for display and day boundaries.
 */
export const BUSINESS_TIME_ZONE = "Africa/Nairobi";
const NAIROBI_OFFSET = "+03:00";

/** "2026-10-09" for the business day `date` falls on. */
export function businessDate(date: Date, timeZone: string = BUSINESS_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Midnight at the start of the Nairobi business day containing `date`, as a UTC instant. */
export function startOfBusinessDay(date: Date): Date {
  return new Date(`${businessDate(date)}T00:00:00${NAIROBI_OFFSET}`);
}
