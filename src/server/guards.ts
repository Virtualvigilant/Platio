import "server-only";
import { notFound, redirect } from "next/navigation";
import { ConfigError } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "./session";

/**
 * Access checks for protected pages. Call them in the page itself (layouts render in parallel
 * with pages, so a layout check alone does not stop the page's queries). These decide what to
 * render; the database's row-level security decides what data comes back.
 */
export async function requireViewer(nextPath: string) {
  const supabase = await createClient();
  if (!supabase) throw new ConfigError("Supabase is not configured");
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { supabase, viewer };
}

export async function requirePlatformStaff(nextPath: string) {
  const ctx = await requireViewer(nextPath);
  if (!ctx.viewer.platformRole) notFound();
  return ctx;
}
