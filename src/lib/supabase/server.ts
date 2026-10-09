import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/env";

/**
 * A Supabase client for Server Components, Server Actions and Route Handlers, acting as the
 * signed-in user. Every query runs under row-level security. Returns null when Supabase is not
 * configured, so pages can explain that instead of crashing.
 */
export async function createClient() {
  // Read cookies first: it marks the route as per-request even when Supabase is not configured.
  const cookieStore = await cookies();
  const config = getSupabaseConfig();
  if (!config.ok) return null;

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session on every
          // request, so this is safe to ignore there.
        }
      },
    },
  });
}

export type ServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
