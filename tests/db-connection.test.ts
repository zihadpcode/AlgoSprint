import { describe, expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import { connectionOptions } from "../src/lib/db/connection";
import { SUPABASE_ROOT_CA } from "../src/lib/db/supabase-ca";

const supabase = "postgresql://postgres.abcdefghijklmnopqrst:test%40credential@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=verify-full";

describe("database connection options", () => {
  it("embeds the published Supabase root certificate", () => {
    const cert = new X509Certificate(SUPABASE_ROOT_CA);
    expect(cert.subject).toContain("CN=Supabase Root 2021 CA");
    expect(cert.ca).toBe(true);
    expect(cert.fingerprint256).toBe("80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA");
    expect(new Date(cert.validTo).getTime()).toBeGreaterThan(Date.now());
  });
  it("supplies the Supabase CA for verify-full without weakening verification", () => {
    const options = connectionOptions(supabase);
    expect(options.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(options.ssl?.ca).toContain(SUPABASE_ROOT_CA);
    expect(options.ssl?.ca.length).toBe(rootCertificates.length + 1);
    const url = new URL(options.connectionString);
    expect(url.searchParams.has("sslmode")).toBe(false);
    expect(url.password).toBe("test%40credential");
    expect(url.host).toBe("aws-0-us-east-1.pooler.supabase.com:6543");
    expect(new URL(connectionOptions(`${supabase}&schema=app`).connectionString).searchParams.get("schema")).toBe("app");
  });
  it("passes other URLs through untouched", () => {
    for (const value of [
      "postgresql://user:pass@localhost:5432/algosprint_test",
      "postgresql://user:pass@db.example.com:5432/postgres?sslmode=verify-full",
      supabase.replace("verify-full", "require"),
      supabase.replace("pooler.supabase.com", "pooler.supabase.com.attacker.example"),
    ]) expect(connectionOptions(value)).toEqual({ connectionString: value });
  });
  it("rejects non-PostgreSQL URLs", () => {
    expect(() => connectionOptions("mysql://user:pass@localhost/db")).toThrow();
  });
});
