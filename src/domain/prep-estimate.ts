/**
 * MVP preparation-time suggestion (brief §8.2): the longest baseline prep time among the order's
 * items plus a configurable buffer for the current kitchen load. Staff always confirm or change it.
 * Never present this as AI-powered.
 */

export const DEFAULT_PREP_PRESETS = [5, 10, 15, 20, 30] as const;
export const DEFAULT_TIME_ZONE = "Africa/Nairobi";

export interface PrepItem {
  prepMinutes?: number | null;
}

export interface PrepSettings {
  /** Used when no item in the order has its own prep time. */
  defaultMinutes: number;
  /** Extra minutes per order already accepted or preparing. */
  minutesPerActiveOrder: number;
  /** Cap on the load buffer. */
  maxBufferMinutes: number;
  /** Allowed custom range for staff entries. */
  minMinutes: number;
  maxMinutes: number;
}

export const DEFAULT_PREP_SETTINGS: PrepSettings = {
  defaultMinutes: 10,
  minutesPerActiveOrder: 1,
  maxBufferMinutes: 15,
  minMinutes: 1,
  maxMinutes: 120,
};

export function suggestPrepMinutes(
  items: readonly PrepItem[],
  activeOrders: number,
  settings: PrepSettings = DEFAULT_PREP_SETTINGS,
): number {
  const baselines = items
    .map((i) => i.prepMinutes)
    .filter((m): m is number => typeof m === "number" && m > 0);
  const base = baselines.length ? Math.max(...baselines) : settings.defaultMinutes;
  const buffer = Math.min(
    settings.maxBufferMinutes,
    Math.max(0, Math.floor(activeOrders)) * settings.minutesPerActiveOrder,
  );
  return clampMinutes(base + buffer, settings);
}

export function clampMinutes(minutes: number, settings: PrepSettings = DEFAULT_PREP_SETTINGS) {
  return Math.min(settings.maxMinutes, Math.max(settings.minMinutes, Math.round(minutes)));
}

/** The smallest preset that is at least `minutes`, so one tap covers the suggestion. */
export function nearestPresetAtLeast(
  minutes: number,
  presets: readonly number[] = DEFAULT_PREP_PRESETS,
): number | null {
  const sorted = [...presets].sort((a, b) => a - b);
  return sorted.find((p) => p >= minutes) ?? null;
}

export function isValidPrepEntry(minutes: number, settings: PrepSettings = DEFAULT_PREP_SETTINGS) {
  return (
    Number.isInteger(minutes) && minutes >= settings.minMinutes && minutes <= settings.maxMinutes
  );
}

export function addMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

/** "12:50" in the restaurant's local time. Store UTC, display local (brief §8.2, §16). */
export function formatClock(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}
