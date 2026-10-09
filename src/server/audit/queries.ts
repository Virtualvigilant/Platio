import "server-only";
import type { PlatformRole, RestaurantRole } from "@/domain/access";
import {
  describeActor,
  describeAuditEntry,
  formatAuditTime,
  type ActorLabel,
} from "@/domain/audit/describe";
import type { ServerClient } from "@/lib/supabase/server";

/** How many change-log rows one page shows. */
export const AUDIT_PAGE_SIZE = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One change-log row, ready to show. */
export interface AuditEntry {
  id: number;
  occurredAt: string;
  /** "9 Oct 2026, 14:05" in Nairobi time. */
  when: string;
  action: string;
  /** "Changed the price of Pilau from KES 350 to KES 360". */
  summary: string;
  actor: ActorLabel;
  reason: string | null;
}

export type AuditPage =
  | { ok: true; entries: AuditEntry[]; page: number; pageCount: number; total: number }
  | { ok: false };

interface AuditRow {
  id: number;
  actor_id: string | null;
  scope: "platform" | "restaurant";
  action: string;
  reason: string | null;
  safe_metadata: unknown;
  occurred_at: string;
}

/**
 * One page of a restaurant's change log, newest first, read through RLS (platform staff and the
 * restaurant's owners can read audit_logs). People are named as far as the viewer may see:
 * display names from profiles, team emails from list_restaurant_team, and platform roles from
 * platform_staff, which only super-admins can read in full. Lookups that fail are skipped, so a
 * row falls back to "Platform staff" or "Restaurant team" rather than failing the page.
 */
export async function listRestaurantAudit(
  supabase: ServerClient,
  restaurantId: string,
  page: number,
): Promise<AuditPage> {
  if (!UUID.test(restaurantId)) return { ok: false };
  const current = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const from = (current - 1) * AUDIT_PAGE_SIZE;

  const result = await supabase
    .from("audit_logs")
    .select("id, actor_id, scope, action, reason, safe_metadata, occurred_at", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);

  if (result.error) {
    // PostgREST answers a page past the end with "range not satisfiable"; show it as empty.
    if (result.error.code !== "PGRST103") return { ok: false };
    const total = await countEntries(supabase, restaurantId);
    if (total === null) return { ok: false };
    return { ok: true, entries: [], page: current, pageCount: pages(total), total };
  }

  const rows = (result.data ?? []) as AuditRow[];
  const total = result.count ?? rows.length;
  const people = await lookUpPeople(supabase, restaurantId, rows);

  const entries = rows.map((row): AuditEntry => {
    const actorId = row.actor_id;
    return {
      id: row.id,
      occurredAt: row.occurred_at,
      when: formatAuditTime(row.occurred_at),
      action: row.action,
      summary: describeAuditEntry(row.action, row.safe_metadata, {
        personName: (userId) => people.displayNames.get(userId) ?? people.emails.get(userId),
      }),
      actor: describeActor({
        actorId,
        displayName: actorId ? people.displayNames.get(actorId) : null,
        email: actorId ? people.emails.get(actorId) : null,
        platformRole: actorId ? people.platformRoles.get(actorId) : null,
        membershipRole: actorId ? people.memberRoles.get(actorId) : null,
      }),
      reason: row.reason?.trim() ? row.reason.trim() : null,
    };
  });

  return { ok: true, entries, page: current, pageCount: pages(total), total };
}

function pages(total: number) {
  return Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
}

async function countEntries(supabase: ServerClient, restaurantId: string) {
  const { count, error } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);
  return error ? null : (count ?? 0);
}

interface People {
  displayNames: Map<string, string>;
  emails: Map<string, string>;
  platformRoles: Map<string, PlatformRole>;
  memberRoles: Map<string, RestaurantRole>;
}

/** Everyone a page of rows mentions: the actors, plus the people team changes were about. */
async function lookUpPeople(
  supabase: ServerClient,
  restaurantId: string,
  rows: readonly AuditRow[],
): Promise<People> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.actor_id && UUID.test(row.actor_id)) ids.add(row.actor_id);
    const meta = row.safe_metadata as { user_id?: unknown } | null;
    if (row.action.startsWith("membership.") && typeof meta?.user_id === "string") {
      if (UUID.test(meta.user_id)) ids.add(meta.user_id);
    }
  }

  const people: People = {
    displayNames: new Map(),
    emails: new Map(),
    platformRoles: new Map(),
    memberRoles: new Map(),
  };
  if (ids.size === 0) return people;
  const list = [...ids];

  const [profiles, staff, memberships, team] = await Promise.all([
    supabase.from("profiles").select("id, display_name").in("id", list),
    // Super-admins read every row; support staff only their own. Missing rows mean "unknown".
    supabase.from("platform_staff").select("user_id, role").in("user_id", list),
    supabase
      .from("restaurant_memberships")
      .select("user_id, role, status, created_at")
      .eq("restaurant_id", restaurantId)
      .in("user_id", list)
      .order("created_at", { ascending: true }),
    supabase.rpc("list_restaurant_team", { p_restaurant_id: restaurantId }),
  ]);

  for (const p of (profiles.data ?? []) as { id: string; display_name: string | null }[]) {
    if (p.display_name?.trim()) people.displayNames.set(p.id, p.display_name.trim());
  }
  for (const s of (staff.data ?? []) as { user_id: string; role: PlatformRole }[]) {
    people.platformRoles.set(s.user_id, s.role);
  }
  // Oldest first, so the latest membership (the current role) wins.
  for (const m of (memberships.data ?? []) as { user_id: string; role: RestaurantRole }[]) {
    people.memberRoles.set(m.user_id, m.role);
  }
  for (const t of (team.data ?? []) as { user_id: string; email: string | null }[]) {
    if (ids.has(t.user_id) && t.email) people.emails.set(t.user_id, t.email);
  }
  return people;
}
