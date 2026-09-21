import { rootCertificates } from "node:tls";
import { SUPABASE_ROOT_CA } from "@/lib/db/supabase-ca";

const SUPABASE_HOSTS = /(?:^|\.)supabase\.(?:com|co)$/;

// Options for pg from a connection URL. pg lets URL parameters override explicit
// options, and `sslmode=verify-full` becomes a bare `ssl: {}`, so a CA cannot be
// added without rewriting the URL. Supabase signs its Postgres endpoints with its
// own root, absent from Node's bundled store; supply it while keeping full
// certificate and hostname verification. Every other URL is passed through as is.
export function connectionOptions(connectionString: string) {
  const url = new URL(connectionString);
  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("Use a PostgreSQL connection URL for the pg adapter.");
  }
  if (url.searchParams.get("sslmode") !== "verify-full" || !SUPABASE_HOSTS.test(url.hostname)) {
    return { connectionString };
  }
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ca: [...rootCertificates, SUPABASE_ROOT_CA] },
  };
}
