/**
 * Money is always an integer number of minor units (cents) plus a currency code.
 * Never do arithmetic on floats and never trust a total calculated in the browser.
 */

export const DEFAULT_CURRENCY = "KES" as const;
export type Currency = typeof DEFAULT_CURRENCY;

export class MoneyError extends Error {
  override name = "MoneyError";
}

export function assertMinor(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a whole number of cents, got ${value}`);
  }
  return value;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, v) => total + assertMinor(v), 0);
}

export function multiplyMinor(unitMinor: number, quantity: number): number {
  assertMinor(unitMinor, "unit price");
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new MoneyError(`quantity must be a whole number ≥ 0, got ${quantity}`);
  }
  return assertMinor(unitMinor * quantity, "line total");
}

/** 35000 → "KES 350", 35050 → "KES 350.50", 125000 → "KES 1,250", -5000 → "−KES 50". */
export function formatKES(minor: number): string {
  assertMinor(minor);
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const amount = cents ? `${grouped}.${String(cents).padStart(2, "0")}` : grouped;
  return `${minor < 0 ? "−" : ""}KES ${amount}`;
}

/**
 * Parses what an admin types into a price field ("350", "350.5", "1,250.00", "KES 99")
 * into minor units. Returns null for anything that is not a non-negative amount
 * with at most two decimal places.
 */
export function parseKES(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/^KES\s*/i, "")
    .replace(/,/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = match[2] ? Number(match[2].padEnd(2, "0")) : 0;
  return whole * 100 + cents;
}
