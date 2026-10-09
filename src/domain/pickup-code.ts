/**
 * Pickup codes are random, non-sequential and never derived from a database key (brief §8.3).
 * The alphabet leaves out characters that are easy to confuse when read aloud or off a phone:
 * 0/O/Q, 1/I/L, 2/Z, 5/S, 6/G, 8/B.
 */

export const PICKUP_ALPHABET = "ACDEFHJKMNPRTUVWXY3479";
export const PICKUP_CODE_LENGTH = 4;

type RandomSource = (bytes: Uint8Array) => Uint8Array;

const cryptoRandom: RandomSource = (bytes) => globalThis.crypto.getRandomValues(bytes);

export function generatePickupCode(
  length: number = PICKUP_CODE_LENGTH,
  random: RandomSource = cryptoRandom,
): string {
  const n = PICKUP_ALPHABET.length;
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % n);
  let code = "";
  while (code.length < length) {
    const bytes = random(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && code.length < length) code += PICKUP_ALPHABET[b % n];
    }
  }
  return code;
}

/** What staff type is forgiving about case, spaces and hyphens. */
export function normalizePickupCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isWellFormedPickupCode(input: string, length: number = PICKUP_CODE_LENGTH) {
  const code = normalizePickupCode(input);
  return code.length === length && [...code].every((c) => PICKUP_ALPHABET.includes(c));
}
