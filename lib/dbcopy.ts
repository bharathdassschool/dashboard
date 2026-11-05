import "server-only";
import { Pool, type PoolClient } from "pg";
import { SCHEMA } from "./schema";

/**
 * Copies this app's whole database into the new Singapore database (SG_DATABASE_URL), table by table.
 * It only ever READS the current database and only WRITES the new one, which is emptied first, so it can be run as
 * often as needed (a trial copy now, a final fresh copy at switch-over). Returns the row count of every table on both
 * sides so they can be compared.
 */
export function currentDbUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL || "";
}

function pool(url: string) {
  return new Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
}

type Col = { name: string; type: string };

/** Public tables in an order where every table comes after the tables it refers to. */
async function tablesInOrder(c: PoolClient) {
  const tables = (await c.query<{ t: string }>(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  )).rows.map((r) => r.t);
  const deps = (await c.query<{ child: string; parent: string }>(
    `SELECT DISTINCT tc.relname AS child, tp.relname AS parent FROM pg_constraint k
     JOIN pg_class tc ON tc.oid = k.conrelid JOIN pg_class tp ON tp.oid = k.confrelid
     JOIN pg_namespace n ON n.oid = tc.relnamespace WHERE k.contype = 'f' AND n.nspname = 'public'`,
  )).rows;
  const order: string[] = [];
  const left = new Set(tables);
  while (left.size) {
    const ready = [...left].filter((t) => !deps.some((d) => d.child === t && d.parent !== t && left.has(d.parent)));
    const next = ready.length ? ready : [...left]; // a cycle: just continue
    for (const t of next) {
      order.push(t);
      left.delete(t);
    }
  }
  return order;
}

async function columns(c: PoolClient, table: string): Promise<Col[]> {
  return (await c.query<Col>(
    "SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
    [table],
  )).rows;
}

const qi = (id: string) => `"${id.replace(/"/g, '""')}"`;

export type CopyResult = { ok: boolean; tables: { table: string; from: number; to: number }[]; error?: string };

export async function copyToSingapore(): Promise<CopyResult> {
  const fromUrl = currentDbUrl();
  const toUrl = process.env.SG_DATABASE_URL || "";
  if (!fromUrl || !toUrl) return { ok: false, tables: [], error: "DATABASE_URL or SG_DATABASE_URL is missing" };
  if (fromUrl === toUrl) return { ok: false, tables: [], error: "Already using the Singapore database" };
  const src = pool(fromUrl);
  const dst = pool(toUrl);
  const s = await src.connect();
  const d = await dst.connect();
  const result: CopyResult["tables"] = [];
  try {
    // Same tables in the new database (the app's own schema), then empty them.
    for (const stmt of SCHEMA) await d.query(stmt);
    const order = await tablesInOrder(s);
    const existing = new Set((await d.query<{ t: string }>(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    )).rows.map((r) => r.t));
    const targets = order.filter((t) => existing.has(t));
    if (targets.length) await d.query(`TRUNCATE ${targets.map(qi).join(", ")} RESTART IDENTITY CASCADE`);

    for (const table of targets) {
      const srcCols = await columns(s, table);
      const dstNames = new Set((await columns(d, table)).map((c) => c.name));
      const cols = srcCols.filter((c) => dstNames.has(c.name));
      // Everything travels as text (exact numbers, dates and JSON), except files, which stay binary.
      const select = cols.map((c) => (c.type === "bytea" ? qi(c.name) : `${qi(c.name)}::text AS ${qi(c.name)}`)).join(", ");
      const hasId = cols.some((c) => c.name === "id");
      const batch = cols.some((c) => c.type === "bytea") ? 20 : 500;
      let offset = 0;
      for (;;) {
        const rows = (await s.query(`SELECT ${select} FROM ${qi(table)} ORDER BY ${hasId ? "id" : "ctid"} LIMIT ${batch} OFFSET ${offset}`)).rows;
        if (!rows.length) break;
        const params: unknown[] = [];
        const values = rows.map((r) => `(${cols.map((c) => {
          params.push(r[c.name]);
          return `$${params.length}`;
        }).join(", ")})`);
        await d.query(`INSERT INTO ${qi(table)} (${cols.map((c) => qi(c.name)).join(", ")}) VALUES ${values.join(", ")}`, params);
        offset += rows.length;
        if (rows.length < batch) break;
      }
      // Keep new ids continuing after the copied ones.
      if (hasId) {
        await d.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${qi(table)}), 0) + 1, false)
           WHERE pg_get_serial_sequence($1, 'id') IS NOT NULL`,
          [table],
        );
      }
      const [a, b] = await Promise.all([
        s.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${qi(table)}`),
        d.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${qi(table)}`),
      ]);
      result.push({ table, from: a.rows[0].n, to: b.rows[0].n });
    }
    return { ok: result.every((r) => r.from === r.to), tables: result };
  } catch (e) {
    return { ok: false, tables: result, error: e instanceof Error ? e.message : String(e) };
  } finally {
    s.release();
    d.release();
    await Promise.all([src.end(), dst.end()]);
  }
}
