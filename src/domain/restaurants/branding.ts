/**
 * Restaurant colours are configurable within safe constraints (brief §7.3): a colour is accepted
 * only when white or DineFlow ink text reaches 4.5:1 on it. Otherwise the storefront keeps the
 * system default and the admin is told why.
 */

export const INK = "#182433";
export const WHITE = "#ffffff";
export const MIN_CONTRAST = 4.5;

const HEX = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const m = HEX.exec(hex);
  if (!m) throw new Error(`Expected a #rrggbb colour, got ${hex}`);
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type TenantColorCheck =
  { ok: true; color: string; onColor: string; ratio: number } | { ok: false; reason: string };

/** Picks the text colour for a restaurant colour, preferring white. */
export function checkTenantColor(color: string): TenantColorCheck {
  if (!isHexColor(color)) return { ok: false, reason: "Enter a colour as #rrggbb." };
  const normalized = color.toLowerCase();
  for (const onColor of [WHITE, INK]) {
    const ratio = contrastRatio(normalized, onColor);
    if (ratio >= MIN_CONTRAST) return { ok: true, color: normalized, onColor, ratio };
  }
  return {
    ok: false,
    reason:
      "Text would be hard to read on this colour. Choose a darker or lighter shade, or keep the DineFlow default.",
  };
}
