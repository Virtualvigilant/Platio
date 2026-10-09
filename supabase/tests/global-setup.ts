import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { FIXTURES_SQL } from "./fixtures";

const ROOT = join(import.meta.dirname, "..", "..");
export const TEST_DB = "dineflow_test";

/** Creates a fresh database, applies the Supabase stub, every migration in order, then fixtures. */
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Start a Postgres with `npm run db:test-server` and export the URL it prints.",
    );
  }

  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const testUrl = new URL(url);
  testUrl.pathname = `/${TEST_DB}`;

  const db = new pg.Client({ connectionString: testUrl.toString() });
  await db.connect();
  try {
    await db.query(readFileSync(join(ROOT, "supabase/tests/supabase-stub.sql"), "utf8"));
    const dir = join(ROOT, "supabase/migrations");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await db.query("begin");
      await db.query(readFileSync(join(dir, file), "utf8"));
      await db.query("commit");
    }
    await db.query(FIXTURES_SQL);
  } finally {
    await db.end();
  }
}
