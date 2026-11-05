import { Pool, types, type PoolClient } from "pg";

// Return DATE columns as plain "YYYY-MM-DD" strings and NUMERIC/BIGINT as JS numbers.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

import { SCHEMA } from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool; schemaReady?: Promise<void> };

/** Neon on Vercel may expose the connection string under any of these names. */
export function databaseUrl() {
  // Switch-over to the Singapore database: set USE_SG_DATABASE=1 in Vercel (no code change).
  if (process.env.USE_SG_DATABASE === "1" && process.env.SG_DATABASE_URL) return process.env.SG_DATABASE_URL;
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL || "";
}

function getPool(): Pool {
  if (!globalForDb.pool) {
    const url = databaseUrl();
    if (!url) throw new Error("DATABASE_URL is not set. Connect a Postgres database in Vercel → Storage.");
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalForDb.pool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX) || 3,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForDb.pool;
}

async function ensureSchema() {
  if (!globalForDb.schemaReady) {
    globalForDb.schemaReady = (async () => {
      const client = await getPool().connect();
      try {
        for (const stmt of SCHEMA) await client.query(stmt);
      } finally {
        client.release();
      }
    })().catch((e) => {
      globalForDb.schemaReady = undefined;
      throw e;
    });
  }
  return globalForDb.schemaReady;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function q1<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await getPool().connect();
  let broken: Error | undefined;
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch((err: Error) => (broken = err));
    throw e;
  } finally {
    // Passing an error makes the pool discard the connection instead of reusing it.
    client.release(broken);
  }
}
