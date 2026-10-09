import "server-only";
import type {
  StorefrontCategory,
  StorefrontData,
  StorefrontMenuItem,
} from "@/components/storefront/types";
import { formatKES } from "@/domain/money";
import { getBusinessState, type BusinessState } from "@/domain/restaurants/business-status";
import type { StorefrontLayout } from "@/domain/restaurants/config";
import {
  formatClosure,
  summarizeWeeklyHours,
  upcomingClosures,
} from "@/domain/restaurants/hours-display";
import type { RestaurantStatus } from "@/domain/restaurants/lifecycle";
import type { ServerClient } from "@/lib/supabase/server";
import { publicAssetUrl } from "@/server/storage";

export type { StorefrontCategory, StorefrontData, StorefrontMenuItem };

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

function businessState(
  row: RestaurantRow,
  now: Date,
  lifecycle: string = row.status,
  acceptingOrders: boolean = row.accepting_orders,
): BusinessState {
  return getBusinessState({
    lifecycle,
    acceptingOrders,
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
}

function toSummary(row: RestaurantRow, now: Date, prices?: number[]): RestaurantSummary {
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
    state: businessState(row, now),
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

// ---------------------------------------------------------------------------------------------
// Storefront: one restaurant's public page, and the admin preview of the same page
// ---------------------------------------------------------------------------------------------

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

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

interface ProfileRow extends RestaurantRow {
  cover_path: string | null;
  storefront_layout: StorefrontLayout | null;
  public_phone: string | null;
  service_area: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  pickup_enabled: boolean;
  dine_in_enabled: boolean;
  menu_categories: CategoryRow[];
  menu_items: (MenuItemRow & { active: boolean })[];
}

// Everything the storefront shows. Still only public columns: no private record, payment
// settings, pause reasons or closure reasons.
const STOREFRONT_FIELDS = `${PUBLIC_FIELDS},
  cover_path, storefront_layout, public_phone, service_area, latitude, longitude,
  pickup_enabled, dine_in_enabled,
  menu_categories (id, name, description, sort_order, active),
  menu_items (id, name, description, image_path, price_minor, prep_minutes, tags, availability, sort_order, category_id, active)
`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function coordinates(row: ProfileRow): StorefrontData["coordinates"] {
  if (row.latitude === null || row.longitude === null) return null;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/**
 * Archived categories and items are hidden; so are categories with nothing left in them. Members
 * and platform staff can read archived rows through RLS, so this filter is what keeps the admin
 * preview identical to the public page.
 */
function menu(row: ProfileRow): StorefrontCategory[] {
  const items = row.menu_items.filter((i) => i.active).sort((a, b) => a.sort_order - b.sort_order);
  return row.menu_categories
    .filter((c) => c.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      items: items
        .filter((i) => i.category_id === c.id)
        .map((i): StorefrontMenuItem => ({
          id: i.id,
          name: i.name,
          description: i.description,
          priceMinor: i.price_minor,
          prepMinutes: i.prep_minutes,
          tags: i.tags,
          imageUrl: publicAssetUrl(i.image_path),
          available: i.availability === "available",
        })),
    }))
    .filter((c) => c.items.length > 0);
}

function toStorefront(row: ProfileRow, state: BusinessState, now: Date): StorefrontData {
  const closures = upcomingClosures(
    row.restaurant_closures.map((c) => ({
      startAt: new Date(c.start_at),
      endAt: new Date(c.end_at),
    })),
    now,
  );
  return {
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    description: row.description,
    cuisine: row.cuisine_tags,
    logoUrl: publicAssetUrl(row.logo_path),
    coverUrl: publicAssetUrl(row.cover_path),
    layout: row.storefront_layout === "cover" ? "cover" : "standard",
    brandColor: row.brand_color,
    brandOnColor: row.brand_on_color,
    state,
    orderModes: { pickup: row.pickup_enabled, dineIn: row.dine_in_enabled },
    pickupInstructions: row.pickup_instructions,
    address: row.address,
    serviceArea: row.service_area,
    directions: row.directions,
    coordinates: coordinates(row),
    publicPhone: row.public_phone,
    hours: summarizeWeeklyHours(
      row.restaurant_hours.map((h) => ({
        weekday: h.weekday,
        opensAt: h.opens_at,
        closesAt: h.closes_at,
      })),
    ),
    closures: closures.map((c) => formatClosure(c, { now, timeZone: row.timezone })),
    categories: menu(row),
  };
}

/** A published or paused restaurant's storefront by web address; null for anything else. */
export async function getRestaurantProfile(
  supabase: ServerClient,
  slug: string,
  now = new Date(),
): Promise<StorefrontData | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select(STOREFRONT_FIELDS)
    .eq("slug", slug)
    .in("status", ["published", "paused"])
    // Past closures don't affect the page; leave them out of the response.
    .gt("restaurant_closures.end_at", now.toISOString())
    .maybeSingle();
  if (error) throw new Error(`Could not load restaurant: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as ProfileRow;
  return toStorefront(row, businessState(row, now), now);
}

export type StorefrontPreview = StorefrontData & { status: RestaurantStatus };

/**
 * The storefront of any restaurant the viewer can read, whatever its status, for the admin
 * preview (brief §4.2 step 3, §7.3). It is never public: the route that shows it checks for
 * platform staff, and RLS returns drafts only to platform staff and the restaurant's members.
 *
 * Open, closed and paused are shown as customers would see them once the restaurant is
 * published: a first publish turns ordering on, so a never-published draft isn't shown as
 * paused just because ordering is still off.
 */
export async function getRestaurantPreview(
  supabase: ServerClient,
  id: string,
  now = new Date(),
): Promise<StorefrontPreview | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabase
    .from("restaurants")
    .select(`${STOREFRONT_FIELDS}, first_published_at`)
    .eq("id", id)
    .gt("restaurant_closures.end_at", now.toISOString())
    .maybeSingle();
  if (error) throw new Error(`Could not load restaurant: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as ProfileRow & { first_published_at: string | null };
  const status = row.status as RestaurantStatus;
  const state = businessState(
    row,
    now,
    status === "paused" ? "paused" : "published",
    row.first_published_at ? row.accepting_orders : true,
  );
  return { ...toStorefront(row, state, now), status };
}
