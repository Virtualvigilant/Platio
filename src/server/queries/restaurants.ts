import "server-only";
import { formatKES } from "@/domain/money";
import { getBusinessState, type BusinessState } from "@/domain/restaurants/business-status";
import type { ServerClient } from "@/lib/supabase/server";
import { publicAssetUrl } from "@/server/storage";

interface HoursRow {
  weekday: number;
  opens_at: string;
  closes_at: string;
}
interface ClosureRow {
  start_at: string;
  end_at: string;
}

interface RestaurantRow {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  cuisine_tags: string[];
  logo_path: string | null;
  brand_color: string | null;
  brand_on_color: string | null;
  status: string;
  accepting_orders: boolean;
  timezone: string;
  pickup_instructions: string | null;
  directions: string | null;
  address: string | null;
  restaurant_hours: HoursRow[];
  restaurant_closures: ClosureRow[];
}

export interface RestaurantSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cuisine: string[];
  logoUrl: string | null;
  brandColor: string | null;
  brandOnColor: string | null;
  timezone: string;
  state: BusinessState;
  priceCue?: string;
}

// Public profile fields only (brief §7.3: public responses select explicitly published fields).
const PUBLIC_FIELDS = `
  id, slug, display_name, description, cuisine_tags, logo_path, brand_color, brand_on_color,
  status, accepting_orders, timezone, pickup_instructions, directions, address,
  restaurant_hours (weekday, opens_at, closes_at),
  restaurant_closures (start_at, end_at)
`;

function toSummary(row: RestaurantRow, now: Date, prices?: number[]): RestaurantSummary {
  const state = getBusinessState({
    lifecycle: row.status,
    acceptingOrders: row.accepting_orders,
    hours: row.restaurant_hours.map((h) => ({
      weekday: h.weekday,
      opensAt: h.opens_at,
      closesAt: h.closes_at,
    })),
    closures: row.restaurant_closures.map((c) => ({
      startAt: new Date(c.start_at),
      endAt: new Date(c.end_at),
    })),
    now,
    timeZone: row.timezone,
  });
  let priceCue: string | undefined;
  if (prices?.length) {
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    priceCue = lo === hi ? formatKES(lo) : `${formatKES(lo)}–${formatKES(hi).replace("KES ", "")}`;
  }
  return {
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    description: row.description,
    cuisine: row.cuisine_tags,
    logoUrl: publicAssetUrl(row.logo_path),
    brandColor: row.brand_color,
    brandOnColor: row.brand_on_color,
    timezone: row.timezone,
    state,
    priceCue,
  };
}

/** Keeps a search term to letters, digits and spaces so it is safe inside a PostgREST filter. */
export function cleanSearch(q: string | undefined): string {
  return (q ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export async function listMarketplaceRestaurants(
  supabase: ServerClient,
  search?: string,
  now = new Date(),
) {
  const term = cleanSearch(search);
  let query = supabase
    .from("restaurants")
    .select(`${PUBLIC_FIELDS}, menu_items (price_minor, availability)`)
    .in("status", ["published", "paused"])
    .order("display_name");
  if (term) query = query.or(`display_name.ilike.%${term}%,description.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load restaurants: ${error.message}`);

  type Row = RestaurantRow & { menu_items: { price_minor: number; availability: string }[] };
  const rows = (data ?? []) as unknown as Row[];
  const summaries = rows.map((r) =>
    toSummary(
      r,
      now,
      r.menu_items.filter((i) => i.availability === "available").map((i) => i.price_minor),
    ),
  );
  // Open restaurants first, then paused, then closed; alphabetical within each.
  const rank = { open: 0, paused: 1, closed: 2 } as const;
  return summaries.sort((a, b) => rank[a.state.status] - rank[b.state.status]);
}

export interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  price_minor: number;
  prep_minutes: number | null;
  tags: string[];
  availability: "available" | "unavailable";
  sort_order: number;
  category_id: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  items: (MenuItemRow & { imageUrl: string | null })[];
}

export async function getRestaurantProfile(supabase: ServerClient, slug: string, now = new Date()) {
  const { data, error } = await supabase
    .from("restaurants")
    .select(
      `${PUBLIC_FIELDS},
       menu_categories (id, name, description, sort_order, active),
       menu_items (id, name, description, image_path, price_minor, prep_minutes, tags, availability, sort_order, category_id, active)`,
    )
    .eq("slug", slug)
    .in("status", ["published", "paused"])
    .maybeSingle();
  if (error) throw new Error(`Could not load restaurant: ${error.message}`);
  if (!data) return null;

  type Row = RestaurantRow & {
    menu_categories: {
      id: string;
      name: string;
      description: string | null;
      sort_order: number;
      active: boolean;
    }[];
    menu_items: (MenuItemRow & { active: boolean })[];
  };
  const row = data as unknown as Row;
  const items = row.menu_items.filter((i) => i.active).sort((a, b) => a.sort_order - b.sort_order);
  const categories: MenuCategory[] = row.menu_categories
    .filter((c) => c.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      items: items
        .filter((i) => i.category_id === c.id)
        .map((i) => ({ ...i, imageUrl: publicAssetUrl(i.image_path) })),
    }))
    .filter((c) => c.items.length > 0);

  return {
    ...toSummary(row, now),
    pickupInstructions: row.pickup_instructions,
    directions: row.directions,
    address: row.address,
    categories,
  };
}
