import "server-only";
import type { RestaurantStatus } from "@/domain/restaurants/lifecycle";
import {
  READINESS_KEYS,
  type ReadinessCheck,
  type ReadinessKey,
} from "@/domain/restaurants/wizard";
import type { ServerClient } from "@/lib/supabase/server";
import { publicAssetUrl } from "@/server/storage";

/** Every configurable field of one restaurant, as platform staff (or its owner) can read it. */
export interface AdminRestaurant {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  cuisineTags: string[];
  publicPhone: string | null;
  logoPath: string | null;
  logoUrl: string | null;
  coverPath: string | null;
  coverUrl: string | null;
  brandColor: string | null;
  brandOnColor: string | null;
  storefrontLayout: "standard" | "cover";
  serviceArea: string | null;
  address: string | null;
  directions: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  status: RestaurantStatus;
  acceptingOrders: boolean;
  pauseReason: string | null;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  pickupInstructions: string | null;
  prepPresets: number[];
  defaultPrepMinutes: number;
  firstPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  private: {
    legalName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    onboardingNotes: string | null;
  } | null;
}

const COLUMNS = `
  id, slug, display_name, description, cuisine_tags, public_phone, logo_path, cover_path,
  brand_color, brand_on_color, storefront_layout, service_area, address, directions, latitude,
  longitude, timezone, status, accepting_orders, pause_reason, pickup_enabled, dine_in_enabled,
  pickup_instructions, prep_presets, default_prep_minutes, first_published_at, created_at, updated_at,
  restaurant_private (legal_name, contact_email, contact_phone, onboarding_notes)
`;

type Row = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  cuisine_tags: string[];
  public_phone: string | null;
  logo_path: string | null;
  cover_path: string | null;
  brand_color: string | null;
  brand_on_color: string | null;
  storefront_layout: "standard" | "cover";
  service_area: string | null;
  address: string | null;
  directions: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  timezone: string;
  status: RestaurantStatus;
  accepting_orders: boolean;
  pause_reason: string | null;
  pickup_enabled: boolean;
  dine_in_enabled: boolean;
  pickup_instructions: string | null;
  prep_presets: number[];
  default_prep_minutes: number;
  first_published_at: string | null;
  created_at: string;
  updated_at: string;
  // One-to-one embeds come back as an object (or an array in some PostgREST versions).
  restaurant_private:
    | {
        legal_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        onboarding_notes: string | null;
      }
    | {
        legal_name: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        onboarding_notes: string | null;
      }[]
    | null;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** Null when the restaurant doesn't exist or the viewer can't see it (RLS). */
export async function getAdminRestaurant(
  supabase: ServerClient,
  id: string,
): Promise<AdminRestaurant | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data, error } = await supabase
    .from("restaurants")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load restaurant: ${error.message}`);
  if (!data) return null;
  const r = data as unknown as Row;
  const priv = Array.isArray(r.restaurant_private) ? r.restaurant_private[0] : r.restaurant_private;
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    description: r.description,
    cuisineTags: r.cuisine_tags,
    publicPhone: r.public_phone,
    logoPath: r.logo_path,
    logoUrl: publicAssetUrl(r.logo_path),
    coverPath: r.cover_path,
    coverUrl: publicAssetUrl(r.cover_path),
    brandColor: r.brand_color,
    brandOnColor: r.brand_on_color,
    storefrontLayout: r.storefront_layout,
    serviceArea: r.service_area,
    address: r.address,
    directions: r.directions,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    timezone: r.timezone,
    status: r.status,
    acceptingOrders: r.accepting_orders,
    pauseReason: r.pause_reason,
    pickupEnabled: r.pickup_enabled,
    dineInEnabled: r.dine_in_enabled,
    pickupInstructions: r.pickup_instructions,
    prepPresets: r.prep_presets,
    defaultPrepMinutes: r.default_prep_minutes,
    firstPublishedAt: r.first_published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    private: priv
      ? {
          legalName: priv.legal_name,
          contactEmail: priv.contact_email,
          contactPhone: priv.contact_phone,
          onboardingNotes: priv.onboarding_notes,
        }
      : null,
  };
}

/** The publish checklist from public.restaurant_readiness, in a stable order. */
export async function getReadiness(supabase: ServerClient, id: string): Promise<ReadinessCheck[]> {
  const { data, error } = await supabase.rpc("restaurant_readiness", { p_restaurant_id: id });
  if (error) throw new Error(`Could not check readiness: ${error.message}`);
  const rows = (data ?? []) as { check_key: ReadinessKey; ok: boolean; message: string }[];
  return READINESS_KEYS.map((key) => {
    const row = rows.find((r) => r.check_key === key);
    return { key, ok: row?.ok ?? false, message: row?.message ?? "" };
  });
}
