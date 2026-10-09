import { z } from "zod";

/**
 * Public configuration, validated once. Supabase's newer "publishable" key and the older "anon"
 * key are interchangeable here. Server secrets (service role, payment keys) never go in this file.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof schema>;

export type SupabaseConfig =
  { ok: true; url: string; key: string; siteUrl: string } | { ok: false; problems: string[] };

export function getSupabaseConfig(): SupabaseConfig {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return {
    ok: true,
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    key: parsed.data.NEXT_PUBLIC_SUPABASE_KEY,
    siteUrl: parsed.data.NEXT_PUBLIC_SITE_URL,
  };
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config.ok) {
    throw new ConfigError(`Supabase is not configured: ${config.problems.join("; ")}`);
  }
  return config;
}
