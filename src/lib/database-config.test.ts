import { describe, expect, it } from "vitest";
import { databaseConfig } from "./database-config";

describe("verified database configuration", () => {
  it("bundles a public CA and prevents URL options from disabling TLS checks", () => {
    const config = databaseConfig({ DATABASE_URL: "postgresql://user:example@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable" });
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.ssl.ca).toContain("-----BEGIN CERTIFICATE-----");
    expect(config.host).toBe("aws-1-eu-west-1.pooler.supabase.com");
  });

  it("fails closed when an explicitly configured CA is unavailable", () => {
    expect(() => databaseConfig({ DATABASE_URL: "postgresql://user:example@db.example.supabase.co/postgres", SUPABASE_DB_CA_FILE: "missing-ca.crt" })).toThrow();
  });
});
