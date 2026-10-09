/** Public restaurant slugs: lowercase ASCII words joined by single hyphens, 3–60 characters. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED = new Set([
  "admin",
  "api",
  "auth",
  "cart",
  "checkout",
  "orders",
  "account",
  "restaurant",
  "new",
]);

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 60 && SLUG_PATTERN.test(slug) && !RESERVED.has(slug);
}
