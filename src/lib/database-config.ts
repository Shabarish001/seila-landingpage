import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function databaseConfig(env: Record<string, string | undefined> = process.env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const url = new URL(env.DATABASE_URL);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }
  if (!url.hostname.endsWith(".supabase.com") && !url.hostname.endsWith(".supabase.co")) {
    throw new Error("DATABASE_URL is not a Supabase connection");
  }
  const ca = env.SUPABASE_DB_CA_CERT?.replace(/\\n/g, "\n")
    || (env.SUPABASE_DB_CA_FILE
      ? readFileSync(/* turbopackIgnore: true */ env.SUPABASE_DB_CA_FILE, "utf8")
      : readFileSync(resolve(process.cwd(), "certs/supabase-ca.crt"), "utf8"));
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    // Pass fields separately so URI options cannot override verified TLS.
    ssl: { ca, rejectUnauthorized: true },
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  };
}
