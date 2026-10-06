import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

/** Conexión directa a PostgreSQL (para migraciones y datos de ejemplo). */
export function dbClient(url = process.env.DATABASE_URL): Client {
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL en .env.local. Cópiala de Supabase → Project Settings → Database → Connection string (Session pooler)."
    );
  }
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return new Client({
    connectionString: url.replace(/[?&]sslmode=[^&]*/, ""),
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
}
