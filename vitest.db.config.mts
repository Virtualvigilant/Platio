import { defineConfig } from "vitest/config";

// Database tests: run the real migrations against a throwaway Postgres and check row-level
// security from the point of view of each role. Needs DATABASE_URL (see scripts/local-postgres.sh).
export default defineConfig({
  test: {
    include: ["supabase/tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["supabase/tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
