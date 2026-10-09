import pg from "pg";
import { afterAll } from "vitest";
import { TEST_DB } from "./global-setup";

let pool: pg.Pool | undefined;

function getPool() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = `/${TEST_DB}`;
  pool ??= new pg.Pool({ connectionString: url.toString(), max: 4 });
  return pool;
}

afterAll(async () => {
  await pool?.end();
  pool = undefined;
});

export type Q = <T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<pg.QueryResult<T>>;

type Who = { role: "anon" } | { role: "authenticated"; userId: string } | { role: "system" };

/**
 * Runs `fn` inside a transaction as the given API role, exactly as PostgREST would: SET ROLE plus
 * the JWT claims auth.uid() reads. Always rolls back, so tests never affect each other.
 */
export async function as<T>(who: Who, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (who.role === "anon") {
      await client.query("set local role anon");
    } else if (who.role === "authenticated") {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: who.userId, role: "authenticated" }),
      ]);
    }
    const q: Q = (sql, params) => client.query(sql, params as unknown[]);
    return await fn(q);
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

export const asUser = <T>(userId: string, fn: (q: Q) => Promise<T>) =>
  as({ role: "authenticated", userId }, fn);
export const asAnon = <T>(fn: (q: Q) => Promise<T>) => as({ role: "anon" }, fn);
export const asSystem = <T>(fn: (q: Q) => Promise<T>) => as({ role: "system" }, fn);

/**
 * Runs one statement inside a savepoint and returns the Postgres error code it failed with, or
 * null if it succeeded. The surrounding transaction stays usable either way.
 */
export async function attempt(q: Q, sql: string, params?: unknown[]): Promise<string | null> {
  await q("savepoint attempt");
  try {
    await q(sql, params);
    await q("release savepoint attempt");
    return null;
  } catch (e) {
    await q("rollback to savepoint attempt");
    return (e as { code?: string }).code ?? "unknown";
  }
}

/** Changes who auth.uid() returns for the rest of the transaction. */
export async function switchUser(q: Q, userId: string) {
  await q("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}
