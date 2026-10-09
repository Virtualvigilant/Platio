import "server-only";
import { cache } from "react";
import type { ClosureView } from "@/components/restaurant-config/closures-editor";
import { formatNairobiDateTime, type Interval } from "@/domain/restaurants/hours-form";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { getAdminRestaurant, getReadiness } from "@/server/admin/restaurants";

/**
 * Reads for the restaurant builder and the restaurant's settings page, through the signed-in
 * user's client so row-level security decides what comes back. Callers check access first with
 * the guards in src/server/guards.ts.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * One restaurant's configuration, shared by the wizard layout and its page in the same request
 * (they render in parallel). Call only after a guard has run.
 */
export const loadRestaurant = cache(async (id: string) => {
  const supabase = await createClient();
  if (!supabase || !UUID.test(id)) return null;
  return getAdminRestaurant(supabase, id);
});

/** The publish checklist, or null when it can't be read (missing restaurant, no access, outage). */
export const loadReadiness = cache(async (id: string) => {
  const supabase = await createClient();
  if (!supabase || !UUID.test(id)) return null;
  try {
    return await getReadiness(supabase, id);
  } catch {
    return null;
  }
});

/** Saved opening periods, as the hours editor expects them. */
export async function getWeeklyHours(supabase: ServerClient, id: string): Promise<Interval[]> {
  const { data, error } = await supabase
    .from("restaurant_hours")
    .select("weekday, opens_at, closes_at")
    .eq("restaurant_id", id)
    .order("weekday")
    .order("opens_at");
  if (error) throw new Error(`Could not load opening hours: ${error.message}`);
  return ((data ?? []) as { weekday: number; opens_at: string; closes_at: string }[]).map((h) => ({
    weekday: h.weekday,
    opensAt: h.opens_at,
    closesAt: h.closes_at,
  }));
}

export interface ClosureRow {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

/** Closures ready for the editor, with times in Nairobi time. */
export function toClosureViews(rows: readonly ClosureRow[], now = new Date()): ClosureView[] {
  return rows.map((c) => {
    const start = new Date(c.startAt);
    const end = new Date(c.endAt);
    return {
      id: c.id,
      starts: formatNairobiDateTime(start),
      ends: formatNairobiDateTime(end),
      reason: c.reason,
      current: start <= now && now < end,
    };
  });
}

/** Temporary closures that haven't ended yet, soonest first. */
export async function getUpcomingClosures(
  supabase: ServerClient,
  id: string,
  now = new Date(),
): Promise<ClosureRow[]> {
  const { data, error } = await supabase
    .from("restaurant_closures")
    .select("id, start_at, end_at, reason")
    .eq("restaurant_id", id)
    .gt("end_at", now.toISOString())
    .order("start_at")
    .limit(50);
  if (error) throw new Error(`Could not load closures: ${error.message}`);
  return (
    (data ?? []) as { id: string; start_at: string; end_at: string; reason: string | null }[]
  ).map((c) => ({ id: c.id, startAt: c.start_at, endAt: c.end_at, reason: c.reason }));
}
