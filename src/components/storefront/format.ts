/** Small display helpers for the storefront. Kept separate so they can be unit tested. */

/** "+254 712 345 678" → "tel:+254712345678"; null when it doesn't look like a phone number. */
export function phoneHref(phone: string): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/** A map link for a stored pin. Built from numbers only, never from restaurant-supplied text. */
export function mapHref(coordinates: { latitude: number; longitude: number }): string | null {
  const { latitude, longitude } = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
}

/** How customers can order, in words. */
export function orderModesLabel(modes: { pickup: boolean; dineIn: boolean }): string | null {
  if (modes.pickup && modes.dineIn) return "Pickup and dine-in";
  if (modes.pickup) return "Pickup only";
  if (modes.dineIn) return "Dine-in only";
  return null;
}
