/**
 * Duplicate-name warning when platform staff add a restaurant (brief §4.3 step 2). Duplicate web
 * addresses are refused by the database; names only warn, because two businesses can share a
 * name. Plain TypeScript with no framework imports, so it is unit tested like the domain rules.
 */

/** Words that say what kind of place it is rather than which one. */
const GENERIC_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "bar",
  "bistro",
  "by",
  "cafe",
  "cafeteria",
  "canteen",
  "co",
  "eatery",
  "food",
  "foods",
  "grill",
  "hotel",
  "house",
  "in",
  "joint",
  "kitchen",
  "kitchens",
  "ltd",
  "limited",
  "of",
  "on",
  "place",
  "restaurant",
  "restaurants",
  "shop",
  "the",
]);

/** "Mama Oliech’s Kitchen & Café" → "mama oliech s kitchen and cafe". */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The words that identify a business: "Mama Oliech Kitchen" → ["mama", "oliech"]. Falls back to
 * every word when the name is only generic words ("The Cafe"). Letters and digits only, so the
 * words are safe to use in a database search pattern.
 */
export function mainWords(name: string): string[] {
  const words = normalizeName(name)
    .split(" ")
    .filter((w) => w.length >= 2);
  const specific = words.filter((w) => !GENERIC_WORDS.has(w));
  return [...new Set(specific.length ? specific : words)].slice(0, 6);
}

export interface ExistingRestaurant {
  id: string;
  displayName: string;
  slug: string;
}

/**
 * The existing restaurants a new one might duplicate: the same web address, the same name, or a
 * name or web address containing all of the new name's main words (or the other way round).
 */
export function findSimilarRestaurants<T extends ExistingRestaurant>(
  name: string,
  slug: string,
  existing: readonly T[],
): T[] {
  const normalized = normalizeName(name);
  const ours = mainWords(name);
  const ourWords = new Set([...normalized.split(" "), ...slug.split("-")]);

  return existing.filter((r) => {
    if (r.slug === slug) return true;
    const theirName = normalizeName(r.displayName);
    if (theirName === normalized) return true;
    const theirWords = new Set([...theirName.split(" "), ...r.slug.split("-")]);
    if (ours.length > 0 && ours.every((w) => theirWords.has(w))) return true;
    const theirs = mainWords(r.displayName);
    return theirs.length > 0 && theirs.every((w) => ourWords.has(w));
  });
}
