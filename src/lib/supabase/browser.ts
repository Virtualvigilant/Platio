"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "@/lib/env";

/** A Supabase client for Client Components, e.g. realtime order updates. */
export function createClient() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient(url, key);
}
