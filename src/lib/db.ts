import "server-only";
import { Pool } from "pg";
import { databaseConfig } from "./database-config";

declare global {
  // Reuse one small pool during local hot reloads and warm serverless invocations.
  var seilaPgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (globalThis.seilaPgPool) return globalThis.seilaPgPool;
  const pool = new Pool(databaseConfig());
  globalThis.seilaPgPool = pool;
  return pool;
}
