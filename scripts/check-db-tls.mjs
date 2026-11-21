// Uses the same connection configuration as the app. No migrations or writes.
import { Pool } from "pg";
import { checkServerIdentity } from "node:tls";
import { databaseConfig } from "../src/lib/database-config.ts";

process.loadEnvFile(".env");
const pool = new Pool(databaseConfig());
try {
  const client = await pool.connect();
  try {
    const socket = client.connection.stream;
    if (!socket.authorized) throw new Error("TLS verification failed");
    const cert = socket.getPeerCertificate();
    const host = databaseConfig().host;
    if (checkServerIdentity(host, cert)) throw new Error("Hostname verification failed");
    if (!checkServerIdentity("wrong-host.invalid", cert)) throw new Error("Hostname mismatch was accepted");
    await client.query("BEGIN READ ONLY");
    const mode = await client.query("SHOW transaction_read_only");
    const products = await client.query("SELECT count(*)::int AS count FROM public.affiliate_products");
    const tables = await client.query("SELECT to_regclass('public.waitlist_signups') AS signups, to_regclass('public.waitlist_rate_limits') AS rate_limits");
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      tlsVerified: socket.authorized,
      protocol: socket.getProtocol(),
      hostnameVerified: true,
      wrongHostnameRejected: true,
      readOnly: mode.rows[0].transaction_read_only === "on",
      productCount: products.rows[0].count,
      waitlistTableExists: Boolean(tables.rows[0].signups),
      rateTableExists: Boolean(tables.rows[0].rate_limits),
    }, null, 2));
  } finally { client.release(); }
} catch (error) {
  // Driver messages can contain connection details. Emit only the error code.
  console.error("Read-only database check failed", { code: error.code || "CHECK_FAILED" });
  process.exitCode = 1;
} finally { await pool.end(); }
