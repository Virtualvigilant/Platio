import "server-only";
import { cache } from "react";
import type { PlatformRole, RestaurantRole } from "@/domain/access";
import { createClient } from "@/lib/supabase/server";

export interface Membership {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  role: RestaurantRole;
}

export interface Viewer {
  userId: string;
  email: string | null;
  memberships: Membership[];
  platformRole: PlatformRole | null;
}

/**
 * The signed-in person and what they may access, read through RLS (so a user only ever sees
 * their own memberships). Cached per request. Null when signed out or Supabase is not configured.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  if (!supabase) return null;

  // getUser() asks Supabase Auth to validate the session; never trust cookies alone for access.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;

  const [memberships, staff] = await Promise.all([
    supabase
      .from("restaurant_memberships")
      .select("role, restaurant:restaurants!inner(id, display_name, slug)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase.from("platform_staff").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  type Row = {
    role: RestaurantRole;
    restaurant: { id: string; display_name: string; slug: string };
  };
  return {
    userId: user.id,
    email: user.email ?? null,
    memberships: ((memberships.data ?? []) as unknown as Row[]).map((m) => ({
      restaurantId: m.restaurant.id,
      restaurantName: m.restaurant.display_name,
      restaurantSlug: m.restaurant.slug,
      role: m.role,
    })),
    platformRole: (staff.data?.role as PlatformRole | undefined) ?? null,
  };
});
