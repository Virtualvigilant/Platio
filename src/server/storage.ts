import { getSupabaseConfig } from "@/lib/env";

/** Public storefront images (logos, covers, dish photos). Private files use another bucket. */
export const PUBLIC_ASSETS_BUCKET = "restaurant-assets";

export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const config = getSupabaseConfig();
  if (!config.ok) return null;
  const safe = path.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/public/${PUBLIC_ASSETS_BUCKET}/${safe}`;
}
