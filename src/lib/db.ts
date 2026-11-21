import "server-only";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

declare global {
  // Reuse one small pool during local hot reloads and warm serverless invocations.
  var seilaPgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (globalThis.seilaPgPool) return globalThis.seilaPgPool;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not configured");
  const url = new URL(raw);
  if (!url.hostname.endsWith(".supabase.com") && !url.hostname.endsWith(".supabase.co")) {
    throw new Error("DATABASE_URL is not a Supabase connection");
  }
  const ca = process.env.SUPABASE_DB_CA_CERT?.replace(/\\n/g, "\n")
    || (process.env.SUPABASE_DB_CA_FILE ? readFileSync(process.env.SUPABASE_DB_CA_FILE, "utf8") : undefined);
  if (!ca) throw new Error("Supabase database CA certificate is not configured");
  const pool = new Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: { ca, rejectUnauthorized: true },
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  globalThis.seilaPgPool = pool;
  return pool;
}
