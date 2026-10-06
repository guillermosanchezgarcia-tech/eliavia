/**
 * Aplica, en orden, las migraciones SQL de supabase/migrations que aún no se hayan aplicado.
 * Uso: npm run db:migrate
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { dbClient } from "./db";

export async function migrate(url?: string, log = console.log) {
  const client = dbClient(url);
  await client.connect();
  try {
    await client.query(`create schema if not exists app_meta;
      create table if not exists app_meta.schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
    const dir = path.join(__dirname, "..", "supabase", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query("select name from app_meta.schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (applied.has(file)) continue;
      log(`→ Aplicando ${file}`);
      await client.query("begin");
      try {
        await client.query(readFileSync(path.join(dir, file), "utf8"));
        await client.query("insert into app_meta.schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw new Error(`Error en ${file}: ${(e as Error).message}`);
      }
    }
    log("✔ Base de datos al día");
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  migrate().catch((e) => {
    console.error("✖", e.message);
    process.exit(1);
  });
}
