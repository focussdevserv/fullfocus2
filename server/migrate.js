import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* Runner de migrations versionado.
   1. Aplica server/schema.sql (baseline idempotente, legado).
   2. Aplica cada arquivo de server/migrations/*.sql em ordem de nome, uma única vez,
      registrando em schema_migrations. Cada módulo do produto cria o SEU arquivo
      (ex.: 003_inbox_conversas.sql) em vez de editar schema.sql — assim vários
      workers não disputam o mesmo arquivo. */

const here = path.dirname(fileURLToPath(import.meta.url));

export async function listMigrationFiles(directory = path.join(here, "migrations")) {
  let entries = [];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries.filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b, "en"));
}

export async function runMigrations(pool, { schemaFile = path.join(here, "schema.sql"), directory = path.join(here, "migrations"), logger = console } = {}) {
  const schema = await readFile(schemaFile, "utf8");
  await pool.query(schema);
  await pool.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await pool.query("select name from schema_migrations")).rows.map((row) => row.name));
  const files = await listMigrationFiles(directory);
  const client = await pool.connect();
  try {
    for (const name of files) {
      if (applied.has(name)) continue;
      const sql = await readFile(path.join(directory, name), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
        logger.info?.(`[migrate] aplicada ${name}`);
      } catch (error) {
        await client.query("rollback").catch(() => {});
        error.message = `[migrate] falha em ${name}: ${error.message}`;
        throw error;
      }
    }
  } finally {
    client.release();
  }
  return files.filter((name) => !applied.has(name));
}
